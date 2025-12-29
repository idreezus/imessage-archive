"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIndexService = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// Apple epoch offset: milliseconds from Unix epoch (1970) to Apple epoch (2001)
const APPLE_EPOCH_OFFSET_MS = 978307200000;
// Convert Apple timestamp (nanoseconds since 2001) to JS timestamp (ms since 1970).
function appleToJsTimestamp(appleDate) {
    if (appleDate === null || appleDate === 0)
        return 0;
    return Math.floor(appleDate / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
}
// Normalize phone number for consistent matching.
// Strips formatting and handles common variants.
function normalizePhone(phone) {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, "");
    // Handle +1 prefix for US numbers
    if (normalized.startsWith("+1") && normalized.length === 12) {
        // Keep as +1XXXXXXXXXX
        return normalized;
    }
    // If 10 digits without country code, assume US
    if (/^\d{10}$/.test(normalized)) {
        return "+1" + normalized;
    }
    // Return as-is for other formats (emails, international)
    return normalized || phone;
}
class SearchIndexService {
    db;
    indexPath;
    chatDbPath = null;
    constructor(indexPath) {
        this.indexPath = indexPath;
        // Open or create the search index database (writable)
        this.db = new better_sqlite3_1.default(indexPath);
        this.initializeSchema();
    }
    // Initialize FTS5 table and metadata tables.
    initializeSchema() {
        // Create FTS5 virtual table for full-text search
        this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(
        message_rowid UNINDEXED,
        chat_rowid UNINDEXED,
        text,
        sender_handle UNINDEXED,
        date_ts UNINDEXED,
        is_from_me UNINDEXED,
        service UNINDEXED,
        has_attachment UNINDEXED,
        chat_style UNINDEXED,
        chat_display_name UNINDEXED,
        tokenize='porter unicode61'
      );
    `);
        // Create metadata table for tracking sync state
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
        // Create normalized handles lookup table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS handle_normalized (
        original TEXT PRIMARY KEY,
        normalized TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_handle_normalized
        ON handle_normalized(normalized);
    `);
    }
    // Build or rebuild the search index from chat.db.
    buildIndex(chatDb) {
        const startTime = Date.now();
        let messageCount = 0;
        try {
            // Clear existing index
            this.db.exec("DELETE FROM message_fts");
            this.db.exec("DELETE FROM handle_normalized");
            // Prepare insert statements
            const insertMessage = this.db.prepare(`
        INSERT INTO message_fts (
          message_rowid, chat_rowid, text, sender_handle, date_ts,
          is_from_me, service, has_attachment, chat_style, chat_display_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const insertHandle = this.db.prepare(`
        INSERT OR IGNORE INTO handle_normalized (original, normalized)
        VALUES (?, ?)
      `);
            // Query all messages with chat and handle info
            const messageQuery = chatDb.prepare(`
        SELECT
          m.ROWID as messageRowid,
          c.ROWID as chatRowid,
          m.text,
          h.id as senderHandle,
          m.date,
          m.is_from_me as isFromMe,
          m.service,
          m.cache_has_attachments as hasAttachment,
          c.style as chatStyle,
          c.display_name as chatDisplayName
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        JOIN chat c ON cmj.chat_id = c.ROWID
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.associated_message_type IS NULL OR m.associated_message_type = 0
        ORDER BY m.ROWID
      `);
            // Build index in a transaction for performance
            const insertTransaction = this.db.transaction(() => {
                for (const row of messageQuery.iterate()) {
                    // Only index messages with text content
                    if (row.text && row.text.trim()) {
                        insertMessage.run(row.messageRowid, row.chatRowid, row.text, row.senderHandle, appleToJsTimestamp(row.date), row.isFromMe, row.service || "iMessage", row.hasAttachment || 0, row.chatStyle, row.chatDisplayName);
                        messageCount++;
                    }
                    // Index handle for normalized lookup
                    if (row.senderHandle) {
                        insertHandle.run(row.senderHandle, normalizePhone(row.senderHandle));
                    }
                }
            });
            insertTransaction();
            // Update sync state
            const syncTime = Date.now();
            this.db
                .prepare(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_sync_time', ?)`)
                .run(syncTime.toString());
            this.db
                .prepare(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('message_count', ?)`)
                .run(messageCount.toString());
            return {
                success: true,
                messageCount,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                messageCount: 0,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    // Search messages using FTS5.
    search(options) {
        const startTime = Date.now();
        const { query, dateFrom, dateTo, senders, chatType, direction, service, hasAttachment, specificChat, regexMode, limit = 50, offset = 0, } = options;
        // Use regex search if enabled
        if (regexMode && query) {
            return this.searchRegex(options);
        }
        // Build WHERE clauses
        const conditions = [];
        const params = [];
        // FTS5 text search (if query provided)
        if (query && query.trim()) {
            // Escape special FTS5 characters and prepare for MATCH
            const escapedQuery = this.escapeFtsQuery(query);
            conditions.push("message_fts MATCH ?");
            params.push(escapedQuery);
        }
        // Date range filter
        if (dateFrom) {
            conditions.push("date_ts >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            conditions.push("date_ts <= ?");
            params.push(dateTo);
        }
        // Sender filter (with normalization)
        if (senders && senders.length > 0) {
            const normalizedSenders = senders.map(normalizePhone);
            const placeholders = normalizedSenders.map(() => "?").join(",");
            // Look up original handles from normalized
            conditions.push(`(
        sender_handle IN (
          SELECT original FROM handle_normalized
          WHERE normalized IN (${placeholders})
        )
        OR sender_handle IN (${placeholders})
      )`);
            params.push(...normalizedSenders, ...normalizedSenders);
        }
        // Chat type filter
        if (chatType === "dm") {
            conditions.push("chat_style = 45");
        }
        else if (chatType === "group") {
            conditions.push("chat_style = 43");
        }
        // Direction filter
        if (direction === "sent") {
            conditions.push("is_from_me = 1");
        }
        else if (direction === "received") {
            conditions.push("is_from_me = 0");
        }
        // Service filter
        if (service && service !== "all") {
            conditions.push("service = ?");
            params.push(service);
        }
        // Attachment filter
        if (hasAttachment === true) {
            conditions.push("has_attachment = 1");
        }
        else if (hasAttachment === false) {
            conditions.push("has_attachment = 0");
        }
        // Specific chat filter
        if (specificChat) {
            conditions.push("chat_rowid = ?");
            params.push(specificChat);
        }
        // Build query
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        // Count total results
        const countQuery = `SELECT COUNT(*) as total FROM message_fts ${whereClause}`;
        const countResult = this.db.prepare(countQuery).get(...params);
        // Fetch results with pagination
        const selectQuery = `
      SELECT
        message_rowid,
        chat_rowid,
        text,
        sender_handle,
        date_ts,
        is_from_me,
        service,
        has_attachment,
        chat_style,
        chat_display_name
      FROM message_fts
      ${whereClause}
      ORDER BY date_ts DESC
      LIMIT ? OFFSET ?
    `;
        const rows = this.db
            .prepare(selectQuery)
            .all(...params, limit, offset);
        // Transform to response format with snippets
        const results = rows.map((row) => ({
            messageRowid: row.message_rowid,
            chatRowid: row.chat_rowid,
            text: row.text,
            snippet: this.createSnippet(row.text, query),
            senderHandle: row.sender_handle,
            date: row.date_ts,
            isFromMe: row.is_from_me === 1,
            service: row.service,
            hasAttachment: row.has_attachment === 1,
            chatDisplayName: row.chat_display_name,
            chatIsGroup: row.chat_style === 43,
        }));
        return {
            results,
            total: countResult.total,
            hasMore: offset + results.length < countResult.total,
            queryTime: Date.now() - startTime,
        };
    }
    // Search using regex pattern (slower, with timeout).
    searchRegex(options) {
        const startTime = Date.now();
        const TIMEOUT_MS = 5000;
        const { query, dateFrom, dateTo, senders, chatType, direction, service, hasAttachment, specificChat, limit = 50, offset = 0, } = options;
        if (!query) {
            return { results: [], total: 0, hasMore: false, queryTime: 0 };
        }
        // Compile regex (will throw if invalid)
        let regex;
        try {
            regex = new RegExp(query, "i");
        }
        catch {
            return {
                results: [],
                total: 0,
                hasMore: false,
                queryTime: Date.now() - startTime,
            };
        }
        // Build filter conditions (same as regular search, minus FTS)
        const conditions = [];
        const params = [];
        if (dateFrom) {
            conditions.push("date_ts >= ?");
            params.push(dateFrom);
        }
        if (dateTo) {
            conditions.push("date_ts <= ?");
            params.push(dateTo);
        }
        if (senders && senders.length > 0) {
            const normalizedSenders = senders.map(normalizePhone);
            const placeholders = normalizedSenders.map(() => "?").join(",");
            conditions.push(`(
        sender_handle IN (
          SELECT original FROM handle_normalized
          WHERE normalized IN (${placeholders})
        )
        OR sender_handle IN (${placeholders})
      )`);
            params.push(...normalizedSenders, ...normalizedSenders);
        }
        if (chatType === "dm")
            conditions.push("chat_style = 45");
        else if (chatType === "group")
            conditions.push("chat_style = 43");
        if (direction === "sent")
            conditions.push("is_from_me = 1");
        else if (direction === "received")
            conditions.push("is_from_me = 0");
        if (service && service !== "all") {
            conditions.push("service = ?");
            params.push(service);
        }
        if (hasAttachment === true)
            conditions.push("has_attachment = 1");
        else if (hasAttachment === false)
            conditions.push("has_attachment = 0");
        if (specificChat) {
            conditions.push("chat_rowid = ?");
            params.push(specificChat);
        }
        // Must have text for regex matching
        conditions.push("text IS NOT NULL AND text != ''");
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        // Stream through results and apply regex filter
        const selectQuery = `
      SELECT
        message_rowid,
        chat_rowid,
        text,
        sender_handle,
        date_ts,
        is_from_me,
        service,
        has_attachment,
        chat_style,
        chat_display_name
      FROM message_fts
      ${whereClause}
      ORDER BY date_ts DESC
    `;
        const results = [];
        let total = 0;
        let skipped = 0;
        const stmt = this.db.prepare(selectQuery);
        for (const row of stmt.iterate(...params)) {
            // Check timeout
            if (Date.now() - startTime > TIMEOUT_MS) {
                break;
            }
            // Apply regex filter
            if (row.text && regex.test(row.text)) {
                total++;
                // Handle offset/limit
                if (skipped < offset) {
                    skipped++;
                    continue;
                }
                if (results.length < limit) {
                    results.push({
                        messageRowid: row.message_rowid,
                        chatRowid: row.chat_rowid,
                        text: row.text,
                        snippet: this.createSnippet(row.text, query, true),
                        senderHandle: row.sender_handle,
                        date: row.date_ts,
                        isFromMe: row.is_from_me === 1,
                        service: row.service,
                        hasAttachment: row.has_attachment === 1,
                        chatDisplayName: row.chat_display_name,
                        chatIsGroup: row.chat_style === 43,
                    });
                }
            }
        }
        return {
            results,
            total,
            hasMore: total > offset + results.length,
            queryTime: Date.now() - startTime,
        };
    }
    // Escape special FTS5 query characters.
    escapeFtsQuery(query) {
        // For simple queries, wrap each word in quotes to do phrase matching
        // Handle special characters by escaping
        const words = query
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 0);
        if (words.length === 0)
            return '""';
        // Escape each word and join with AND
        return words
            .map((word) => {
            // Escape quotes and special chars
            const escaped = word.replace(/"/g, '""');
            return `"${escaped}"`;
        })
            .join(" ");
    }
    // Create a snippet with highlighted match.
    createSnippet(text, query, isRegex = false) {
        if (!text)
            return "";
        const maxLength = 150;
        const contextChars = 50;
        if (!query || !query.trim()) {
            // No query, just truncate
            return text.length > maxLength
                ? text.substring(0, maxLength) + "..."
                : text;
        }
        let matchIndex = -1;
        let matchLength = 0;
        if (isRegex) {
            try {
                const regex = new RegExp(query, "i");
                const match = text.match(regex);
                if (match && match.index !== undefined) {
                    matchIndex = match.index;
                    matchLength = match[0].length;
                }
            }
            catch {
                // Invalid regex, fall back to simple search
            }
        }
        if (matchIndex === -1) {
            // Simple case-insensitive search for first query word
            const firstWord = query.trim().split(/\s+/)[0].toLowerCase();
            const lowerText = text.toLowerCase();
            matchIndex = lowerText.indexOf(firstWord);
            if (matchIndex >= 0) {
                matchLength = firstWord.length;
            }
        }
        if (matchIndex === -1) {
            // No match found, return truncated text
            return text.length > maxLength
                ? text.substring(0, maxLength) + "..."
                : text;
        }
        // Extract snippet around match
        const start = Math.max(0, matchIndex - contextChars);
        const end = Math.min(text.length, matchIndex + matchLength + contextChars);
        let snippet = text.substring(start, end);
        // Add ellipsis if truncated
        if (start > 0)
            snippet = "..." + snippet;
        if (end < text.length)
            snippet = snippet + "...";
        // Wrap match in <mark> tags
        const matchText = text.substring(matchIndex, matchIndex + matchLength);
        snippet = snippet.replace(new RegExp(this.escapeRegex(matchText), "gi"), "<mark>$&</mark>");
        return snippet;
    }
    // Escape special regex characters.
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    // Get index status.
    getIndexStatus() {
        const messageCountRow = this.db
            .prepare(`SELECT value FROM sync_state WHERE key = 'message_count'`)
            .get();
        const lastSyncRow = this.db
            .prepare(`SELECT value FROM sync_state WHERE key = 'last_sync_time'`)
            .get();
        return {
            indexed: !!messageCountRow,
            messageCount: messageCountRow ? parseInt(messageCountRow.value, 10) : 0,
            lastSyncTime: lastSyncRow ? parseInt(lastSyncRow.value, 10) : null,
            chatDbPath: this.chatDbPath,
        };
    }
    // Set the chat.db path for reference.
    setChatDbPath(path) {
        this.chatDbPath = path;
    }
    // Close database connection.
    close() {
        this.db.close();
    }
}
exports.SearchIndexService = SearchIndexService;
