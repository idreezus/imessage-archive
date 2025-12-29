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

// Reaction row from database query
type ReactionRow = {
  rowid: number;
  guid: string;
  targetMessageGuid: string;
  reactionType: number;
  customEmoji: string | null;
  isFromMe: number;
  date: number;
  reactorIdentifier: string | null;
  reactorService: string | null;
};

// Processed reaction for API response
type Reaction = {
  rowid: number;
  guid: string;
  type: number;
  customEmoji: string | null;
  isFromMe: boolean;
  date: number;
  reactor: {
    identifier: string;
    service: string;
  } | null;
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
  reactions: Reaction[];
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

  // Expose database instance for search index building.
  getDb(): Database.Database {
    return this.db;
  }

  // Fetch all unique handles for autocomplete.
  getAllHandles(): Handle[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT
        h.ROWID as rowid,
        h.id,
        h.service
      FROM handle h
      ORDER BY h.id
    `);

    return stmt.all() as HandleRow[];
  }

  // Fetch all chats for filter dropdown.
  getAllChats(): { rowid: number; displayName: string | null; chatIdentifier: string; isGroup: boolean }[] {
    const stmt = this.db.prepare(`
      SELECT
        c.ROWID as rowid,
        c.display_name as displayName,
        c.chat_identifier as chatIdentifier,
        c.style
      FROM chat c
      ORDER BY c.display_name, c.chat_identifier
    `);

    const rows = stmt.all() as { rowid: number; displayName: string | null; chatIdentifier: string; style: number }[];

    return rows.map(row => ({
      rowid: row.rowid,
      displayName: row.displayName,
      chatIdentifier: row.chatIdentifier,
      isGroup: row.style === 43,
    }));
  }

  // Fetch messages around a specific date for scroll-to navigation.
  getMessagesAroundDate(
    chatId: number,
    targetDate: number,
    contextCount: number = 25
  ): { messages: Message[]; targetIndex: number } {
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
      .all(chatId, appleTargetDate, contextCount + 1) as MessageRow[];
    const afterRows = this.db
      .prepare(afterQuery)
      .all(chatId, appleTargetDate, contextCount) as MessageRow[];

    // Combine and sort chronologically
    const allRows = [...beforeRows.reverse(), ...afterRows];

    // Get reactions for all messages
    const messageGuids = allRows.map(row => row.guid);
    const reactionRows = this.getReactionsForMessages(messageGuids);
    const reactionsByGuid = this.processReactions(reactionRows);

    // Transform to Message format
    const messages: Message[] = allRows.map(row => ({
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
  private getReactionsForMessages(messageGuids: string[]): ReactionRow[] {
    if (messageGuids.length === 0) return [];

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

    return stmt.all(...messageGuids) as ReactionRow[];
  }

  // Process raw reactions: filter removals, group by target message.
  private processReactions(
    reactionRows: ReactionRow[]
  ): Map<string, Reaction[]> {
    // Track reactions by target message and reactor+type key
    const reactionState = new Map<
      string,
      Map<string, { reaction: Reaction; removed: boolean }>
    >();

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

      const messageReactions = reactionState.get(targetGuid)!;

      if (isRemoval) {
        // Mark as removed if exists
        if (messageReactions.has(reactorKey)) {
          messageReactions.get(reactorKey)!.removed = true;
        }
      } else {
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
    const result = new Map<string, Reaction[]>();

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
        AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
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

    // Fetch reactions for these messages
    const messageGuids = messageRows.map((row) => row.guid);
    const reactionRows = this.getReactionsForMessages(messageGuids);
    const reactionsByGuid = this.processReactions(reactionRows);

    // Transform rows to API response format with reactions
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
      reactions: reactionsByGuid.get(row.guid) ?? [],
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
