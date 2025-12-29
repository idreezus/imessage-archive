import Database from "better-sqlite3";

// Apple epoch offset: milliseconds from Unix epoch (1970) to Apple epoch (2001)
const APPLE_EPOCH_OFFSET_MS = 978307200000;

// Convert Apple timestamp (nanoseconds since 2001) to JS timestamp (ms since 1970).
function appleToJsTimestamp(appleDate: number | null): number {
  if (appleDate === null || appleDate === 0) return 0;
  return Math.floor(appleDate / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
}

// Convert JS timestamp back to Apple format for query comparisons.
function jsToAppleTimestamp(jsDate: number): number {
  return (jsDate - APPLE_EPOCH_OFFSET_MS) * 1_000_000;
}

// Handle (contact) row from database
type HandleRow = {
  rowid: number;
  id: string;
  service: string;
};

// Conversation row from database query
type ConversationRow = {
  rowid: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  style: number;
  lastMessageDate: number | null;
  lastMessageText: string | null;
};

// Message row from database query
type MessageRow = {
  rowid: number;
  guid: string;
  text: string | null;
  handleId: number | null;
  date: number;
  isFromMe: number;
  service: string;
  handleIdentifier: string | null;
  handleService: string | null;
};

// Handle type for API responses
type Handle = {
  rowid: number;
  id: string;
  service: string;
};

// Conversation type for API responses
type Conversation = {
  rowid: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  style: number;
  isGroup: boolean;
  lastMessageDate: number;
  lastMessageText: string | null;
  participants: Handle[];
};

// Message type for API responses
type Message = {
  rowid: number;
  guid: string;
  text: string | null;
  handleId: number | null;
  date: number;
  isFromMe: boolean;
  service: string;
  senderHandle?: Handle;
};

// Query options for fetching conversations
type ConversationsOptions = {
  limit?: number;
  offset?: number;
};

// Query options for fetching messages
type MessagesOptions = {
  chatId: number;
  limit?: number;
  beforeDate?: number;
};

// SQLite database service for querying iMessage chat.db.
export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Open database in read-only mode for safety
    this.db = new Database(dbPath, { readonly: true });
    this.db.pragma("foreign_keys = ON");
  }

  // Close database connection.
  close(): void {
    this.db.close();
  }

  // Fetch participants (handles) for a given chat.
  private getParticipantsForChat(chatId: number): Handle[] {
    const stmt = this.db.prepare(`
      SELECT
        h.ROWID as rowid,
        h.id,
        h.service
      FROM handle h
      JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
      WHERE chj.chat_id = ?
    `);

    return stmt.all(chatId) as HandleRow[];
  }

  // Fetch paginated list of conversations with last message preview.
  getConversations(options: ConversationsOptions = {}): {
    conversations: Conversation[];
    total: number;
  } {
    const { limit = 50, offset = 0 } = options;

    // Count total conversations
    const countResult = this.db
      .prepare(`SELECT COUNT(*) as count FROM chat`)
      .get() as { count: number };

    // Query conversations with last message metadata
    const stmt = this.db.prepare(`
      SELECT
        c.ROWID as rowid,
        c.guid,
        c.chat_identifier as chatIdentifier,
        c.display_name as displayName,
        c.style,
        MAX(m.date) as lastMessageDate,
        (
          SELECT text FROM message
          WHERE ROWID = (
            SELECT message_id FROM chat_message_join
            WHERE chat_id = c.ROWID
            ORDER BY message_date DESC LIMIT 1
          )
        ) as lastMessageText
      FROM chat c
      LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
      LEFT JOIN message m ON cmj.message_id = m.ROWID
      GROUP BY c.ROWID
      ORDER BY lastMessageDate DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as ConversationRow[];

    // Transform rows to API response format with participants
    const conversations: Conversation[] = rows.map((row) => {
      const participants = this.getParticipantsForChat(row.rowid);
      return {
        rowid: row.rowid,
        guid: row.guid,
        chatIdentifier: row.chatIdentifier,
        displayName: row.displayName,
        style: row.style,
        isGroup: row.style === 43,
        lastMessageDate: appleToJsTimestamp(row.lastMessageDate),
        lastMessageText: row.lastMessageText,
        participants,
      };
    });

    return {
      conversations,
      total: countResult.count,
    };
  }

  // Fetch messages for a conversation with cursor-based pagination.
  getMessages(options: MessagesOptions): {
    messages: Message[];
    hasMore: boolean;
  } {
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
    `;

    const params: (number | undefined)[] = [chatId];

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
    const rows = stmt.all(...params) as MessageRow[];

    const hasMore = rows.length > limit;
    const messageRows = hasMore ? rows.slice(0, limit) : rows;

    // Transform rows to API response format
    const messages: Message[] = messageRows.map((row) => ({
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
    }));

    // Reverse to chronological order (oldest first for display)
    return {
      messages: messages.reverse(),
      hasMore,
    };
  }

  // Fetch single conversation by ID.
  getConversationById(chatId: number): Conversation | null {
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

    const row = stmt.get(chatId) as ConversationRow | undefined;

    if (!row) return null;

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
