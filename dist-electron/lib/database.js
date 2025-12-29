"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// Apple epoch offset: milliseconds from Unix epoch (1970) to Apple epoch (2001)
const APPLE_EPOCH_OFFSET_MS = 978307200000;
// Convert Apple timestamp (nanoseconds since 2001) to JS timestamp (ms since 1970).
function appleToJsTimestamp(appleDate) {
    if (appleDate === null || appleDate === 0)
        return 0;
    return Math.floor(appleDate / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
}
// Convert JS timestamp back to Apple format for query comparisons.
function jsToAppleTimestamp(jsDate) {
    return (jsDate - APPLE_EPOCH_OFFSET_MS) * 1_000_000;
}
// SQLite database service for querying iMessage chat.db.
class DatabaseService {
    db;
    constructor(dbPath) {
        // Open database in read-only mode for safety
        this.db = new better_sqlite3_1.default(dbPath, { readonly: true });
        this.db.pragma("foreign_keys = ON");
    }
    // Close database connection.
    close() {
        this.db.close();
    }
    // Expose database instance for search index building.
    getDb() {
        return this.db;
    }
    // Fetch handles for autocomplete with optional search and limit.
    getAllHandles(options = {}) {
        const { query, limit = 200 } = options;
        let sql = `
      SELECT DISTINCT
        h.ROWID as rowid,
        h.id,
        h.service
      FROM handle h
    `;
        const params = [];
        if (query && query.trim()) {
            sql += ` WHERE h.id LIKE ?`;
            params.push(`%${query.trim()}%`);
        }
        sql += ` ORDER BY h.id LIMIT ?`;
        params.push(limit);
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }
    // Fetch chats for filter dropdown with optional search and limit.
    getAllChats(options = {}) {
        const { query, limit = 200 } = options;
        let sql = `
      SELECT
        c.ROWID as rowid,
        c.display_name as displayName,
        c.chat_identifier as chatIdentifier,
        c.style
      FROM chat c
    `;
        const params = [];
        if (query && query.trim()) {
            sql += ` WHERE c.display_name LIKE ? OR c.chat_identifier LIKE ?`;
            const pattern = `%${query.trim()}%`;
            params.push(pattern, pattern);
        }
        sql += ` ORDER BY c.display_name, c.chat_identifier LIMIT ?`;
        params.push(limit);
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        return rows.map(row => ({
            rowid: row.rowid,
            displayName: row.displayName,
            chatIdentifier: row.chatIdentifier,
            isGroup: row.style === 43,
        }));
    }
    // Fetch messages around a specific date for scroll-to navigation.
    getMessagesAroundDate(chatId, targetDate, contextCount = 25) {
        const appleTargetDate = jsToAppleTimestamp(targetDate);
        // Get messages before target (older)
        const beforeQuery = `
      SELECT
        m.ROWID as rowid,
        m.guid,
        m.text,
        m.handle_id as handleId,
        m.date,
        m.is_from_me as isFromMe,
        m.service,
        h.id as handleIdentifier,
        h.service as handleService
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE cmj.chat_id = ?
        AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
        AND m.date <= ?
      ORDER BY m.date DESC
      LIMIT ?
    `;
        // Get messages after target (newer)
        const afterQuery = `
      SELECT
        m.ROWID as rowid,
        m.guid,
        m.text,
        m.handle_id as handleId,
        m.date,
        m.is_from_me as isFromMe,
        m.service,
        h.id as handleIdentifier,
        h.service as handleService
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE cmj.chat_id = ?
        AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
        AND m.date > ?
      ORDER BY m.date ASC
      LIMIT ?
    `;
        const beforeRows = this.db
            .prepare(beforeQuery)
            .all(chatId, appleTargetDate, contextCount + 1);
        const afterRows = this.db
            .prepare(afterQuery)
            .all(chatId, appleTargetDate, contextCount);
        // Combine and sort chronologically
        const allRows = [...beforeRows.reverse(), ...afterRows];
        // Get reactions for all messages
        const messageGuids = allRows.map(row => row.guid);
        const reactionRows = this.getReactionsForMessages(messageGuids);
        const reactionsByGuid = this.processReactions(reactionRows);
        // Transform to Message format
        const messages = allRows.map(row => ({
            rowid: row.rowid,
            guid: row.guid,
            text: row.text,
            handleId: row.handleId,
            date: appleToJsTimestamp(row.date),
            isFromMe: row.isFromMe === 1,
            service: row.service,
            senderHandle: row.handleIdentifier
                ? {
                    rowid: row.handleId ?? 0,
                    id: row.handleIdentifier,
                    service: row.handleService ?? "iMessage",
                }
                : undefined,
            reactions: reactionsByGuid.get(row.guid) ?? [],
        }));
        // Find index of target message (closest to targetDate)
        let targetIndex = 0;
        let minDiff = Infinity;
        for (let i = 0; i < messages.length; i++) {
            const diff = Math.abs(messages[i].date - targetDate);
            if (diff < minDiff) {
                minDiff = diff;
                targetIndex = i;
            }
        }
        return { messages, targetIndex };
    }
    // Fetch reactions for a list of message GUIDs.
    // Note: associated_message_guid has format "p:N/GUID" where N is the part index
    getReactionsForMessages(messageGuids) {
        if (messageGuids.length === 0)
            return [];
        const placeholders = messageGuids.map(() => '?').join(',');
        const stmt = this.db.prepare(`
      SELECT
        r.ROWID as rowid,
        r.guid,
        SUBSTR(r.associated_message_guid, INSTR(r.associated_message_guid, '/') + 1) as targetMessageGuid,
        r.associated_message_type as reactionType,
        r.associated_message_emoji as customEmoji,
        r.is_from_me as isFromMe,
        r.date,
        h.id as reactorIdentifier,
        h.service as reactorService
      FROM message r
      LEFT JOIN handle h ON r.handle_id = h.ROWID
      WHERE SUBSTR(r.associated_message_guid, INSTR(r.associated_message_guid, '/') + 1) IN (${placeholders})
        AND r.associated_message_type >= 2000
      ORDER BY r.date ASC
    `);
        return stmt.all(...messageGuids);
    }
    // Process raw reactions: filter removals, group by target message.
    processReactions(reactionRows) {
        // Track reactions by target message and reactor+type key
        const reactionState = new Map();
        for (const row of reactionRows) {
            const targetGuid = row.targetMessageGuid;
            const isRemoval = row.reactionType >= 3000;
            const effectiveType = isRemoval ? row.reactionType - 1000 : row.reactionType;
            // Create unique key for reactor + reaction type combination
            const reactorKey = row.isFromMe
                ? `me:${effectiveType}`
                : `${row.reactorIdentifier}:${effectiveType}`;
            if (!reactionState.has(targetGuid)) {
                reactionState.set(targetGuid, new Map());
            }
            const messageReactions = reactionState.get(targetGuid);
            if (isRemoval) {
                // Mark as removed if exists
                if (messageReactions.has(reactorKey)) {
                    messageReactions.get(reactorKey).removed = true;
                }
            }
            else {
                // Add or update reaction (later additions override earlier ones)
                messageReactions.set(reactorKey, {
                    reaction: {
                        rowid: row.rowid,
                        guid: row.guid,
                        type: effectiveType,
                        customEmoji: row.customEmoji,
                        isFromMe: row.isFromMe === 1,
                        date: appleToJsTimestamp(row.date),
                        reactor: row.reactorIdentifier
                            ? {
                                identifier: row.reactorIdentifier,
                                service: row.reactorService ?? 'iMessage',
                            }
                            : null,
                    },
                    removed: false,
                });
            }
        }
        // Convert to final format, filtering out removed reactions
        const result = new Map();
        for (const [guid, reactions] of reactionState) {
            const activeReactions = Array.from(reactions.values())
                .filter((r) => !r.removed)
                .map((r) => r.reaction)
                .sort((a, b) => a.date - b.date);
            if (activeReactions.length > 0) {
                result.set(guid, activeReactions);
            }
        }
        return result;
    }
    // Fetch participants (handles) for a given chat.
    getParticipantsForChat(chatId) {
        const stmt = this.db.prepare(`
      SELECT
        h.ROWID as rowid,
        h.id,
        h.service
      FROM handle h
      JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
      WHERE chj.chat_id = ?
    `);
        return stmt.all(chatId);
    }
    // Batch fetch last message text for multiple chats in a single query.
    // Returns a Map of chatId -> lastMessageText for efficient lookup.
    getLastMessageTexts(chatIds) {
        const result = new Map();
        if (chatIds.length === 0)
            return result;
        // Use a single efficient query with ROW_NUMBER window function
        const placeholders = chatIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`
      SELECT chat_id, text FROM (
        SELECT
          cmj.chat_id,
          m.text,
          ROW_NUMBER() OVER (PARTITION BY cmj.chat_id ORDER BY cmj.message_date DESC) as rn
        FROM chat_message_join cmj
        JOIN message m ON cmj.message_id = m.ROWID
        WHERE cmj.chat_id IN (${placeholders})
      ) WHERE rn = 1
    `);
        const rows = stmt.all(...chatIds);
        for (const row of rows) {
            result.set(row.chat_id, row.text);
        }
        return result;
    }
    // Batch fetch participants for multiple chats in a single query.
    // Returns a Map of chatId -> Handle[] for efficient lookup.
    getParticipantsForChats(chatIds) {
        const result = new Map();
        if (chatIds.length === 0)
            return result;
        const placeholders = chatIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`
      SELECT
        h.ROWID as rowid,
        h.id,
        h.service,
        chj.chat_id as chatId
      FROM handle h
      JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
      WHERE chj.chat_id IN (${placeholders})
    `);
        const rows = stmt.all(...chatIds);
        // Group by chatId
        for (const row of rows) {
            const handle = {
                rowid: row.rowid,
                id: row.id,
                service: row.service,
            };
            const existing = result.get(row.chatId);
            if (existing) {
                existing.push(handle);
            }
            else {
                result.set(row.chatId, [handle]);
            }
        }
        return result;
    }
    // Fetch paginated list of conversations with last message preview.
    getConversations(options = {}) {
        const { limit = 50, offset = 0 } = options;
        // Count total conversations
        const countResult = this.db
            .prepare(`SELECT COUNT(*) as count FROM chat`)
            .get();
        // Query conversations with last message date (no correlated subquery)
        const stmt = this.db.prepare(`
      SELECT
        c.ROWID as rowid,
        c.guid,
        c.chat_identifier as chatIdentifier,
        c.display_name as displayName,
        c.style,
        MAX(m.date) as lastMessageDate
      FROM chat c
      LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
      LEFT JOIN message m ON cmj.message_id = m.ROWID
      GROUP BY c.ROWID
      ORDER BY lastMessageDate DESC
      LIMIT ? OFFSET ?
    `);
        const rows = stmt.all(limit, offset);
        // Batch fetch all data in parallel-friendly single queries
        const chatIds = rows.map((row) => row.rowid);
        const participantsByChat = this.getParticipantsForChats(chatIds);
        const lastMessageTexts = this.getLastMessageTexts(chatIds);
        // Transform rows to API response format
        const conversations = rows.map((row) => ({
            rowid: row.rowid,
            guid: row.guid,
            chatIdentifier: row.chatIdentifier,
            displayName: row.displayName,
            style: row.style,
            isGroup: row.style === 43,
            lastMessageDate: appleToJsTimestamp(row.lastMessageDate),
            lastMessageText: lastMessageTexts.get(row.rowid) ?? null,
            participants: participantsByChat.get(row.rowid) ?? [],
        }));
        return {
            conversations,
            total: countResult.count,
        };
    }
    // Fetch messages for a conversation with cursor-based pagination.
    getMessages(options) {
        const { chatId, limit = 50, beforeDate } = options;
        let query = `
      SELECT
        m.ROWID as rowid,
        m.guid,
        m.text,
        m.handle_id as handleId,
        m.date,
        m.is_from_me as isFromMe,
        m.service,
        h.id as handleIdentifier,
        h.service as handleService
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE cmj.chat_id = ?
        AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
    `;
        const params = [chatId];
        // Add cursor filter for pagination
        if (beforeDate) {
            const appleDate = jsToAppleTimestamp(beforeDate);
            query += ` AND m.date < ?`;
            params.push(appleDate);
        }
        // Fetch one extra to determine if more messages exist
        query += ` ORDER BY m.date DESC LIMIT ?`;
        params.push(limit + 1);
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        const hasMore = rows.length > limit;
        const messageRows = hasMore ? rows.slice(0, limit) : rows;
        // Fetch reactions for these messages
        const messageGuids = messageRows.map((row) => row.guid);
        const reactionRows = this.getReactionsForMessages(messageGuids);
        const reactionsByGuid = this.processReactions(reactionRows);
        // Transform rows to API response format with reactions
        const messages = messageRows.map((row) => ({
            rowid: row.rowid,
            guid: row.guid,
            text: row.text,
            handleId: row.handleId,
            date: appleToJsTimestamp(row.date),
            isFromMe: row.isFromMe === 1,
            service: row.service,
            senderHandle: row.handleIdentifier
                ? {
                    rowid: row.handleId ?? 0,
                    id: row.handleIdentifier,
                    service: row.handleService ?? "iMessage",
                }
                : undefined,
            reactions: reactionsByGuid.get(row.guid) ?? [],
        }));
        // Reverse to chronological order (oldest first for display)
        return {
            messages: messages.reverse(),
            hasMore,
        };
    }
    // Fetch single conversation by ID.
    getConversationById(chatId) {
        const stmt = this.db.prepare(`
      SELECT
        c.ROWID as rowid,
        c.guid,
        c.chat_identifier as chatIdentifier,
        c.display_name as displayName,
        c.style,
        MAX(m.date) as lastMessageDate
      FROM chat c
      LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
      LEFT JOIN message m ON cmj.message_id = m.ROWID
      WHERE c.ROWID = ?
      GROUP BY c.ROWID
    `);
        const row = stmt.get(chatId);
        if (!row)
            return null;
        const participants = this.getParticipantsForChat(row.rowid);
        return {
            rowid: row.rowid,
            guid: row.guid,
            chatIdentifier: row.chatIdentifier,
            displayName: row.displayName,
            style: row.style,
            isGroup: row.style === 43,
            lastMessageDate: appleToJsTimestamp(row.lastMessageDate),
            lastMessageText: null,
            participants,
        };
    }
}
exports.DatabaseService = DatabaseService;
