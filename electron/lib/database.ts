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

// Handle row with chat association for batch queries
type HandleWithChatRow = HandleRow & {
  chatId: number;
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

// Attachment row from database query
type AttachmentRow = {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  isSticker: number;
  transferState: number;
  isAudioMessage: number;
  messageId: number;
};

// Attachment type classification
type AttachmentType =
  | "image"
  | "video"
  | "audio"
  | "voice-memo"
  | "sticker"
  | "document"
  | "other";

// Processed attachment for API response
type Attachment = {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  isSticker: boolean;
  isAudioMessage: boolean;
  localPath: string | null;
  type: AttachmentType;
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
  attachments: Attachment[];
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

  // Fetch handles for autocomplete with optional search and limit.
  getAllHandles(options: { query?: string; limit?: number } = {}): Handle[] {
    const { query, limit = 200 } = options;

    let sql = `
      SELECT DISTINCT
        h.ROWID as rowid,
        h.id,
        h.service
      FROM handle h
    `;

    const params: (string | number)[] = [];

    if (query && query.trim()) {
      sql += ` WHERE h.id LIKE ?`;
      params.push(`%${query.trim()}%`);
    }

    sql += ` ORDER BY h.id LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as HandleRow[];
  }

  // Fetch chats for filter dropdown with optional search and limit.
  getAllChats(options: { query?: string; limit?: number } = {}): { rowid: number; displayName: string | null; chatIdentifier: string; isGroup: boolean }[] {
    const { query, limit = 200 } = options;

    let sql = `
      SELECT
        c.ROWID as rowid,
        c.display_name as displayName,
        c.chat_identifier as chatIdentifier,
        c.style
      FROM chat c
    `;

    const params: (string | number)[] = [];

    if (query && query.trim()) {
      sql += ` WHERE c.display_name LIKE ? OR c.chat_identifier LIKE ?`;
      const pattern = `%${query.trim()}%`;
      params.push(pattern, pattern);
    }

    sql += ` ORDER BY c.display_name, c.chat_identifier LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as { rowid: number; displayName: string | null; chatIdentifier: string; style: number }[];

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

    // Get attachments for all messages
    const messageRowids = allRows.map(row => row.rowid);
    const attachmentsByMessage = this.getAttachmentsForMessages(messageRowids);

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
      attachments: attachmentsByMessage.get(row.rowid) ?? [],
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

  // Classify attachment type based on mime type, UTI, and flags.
  private classifyAttachmentType(row: AttachmentRow): AttachmentType {
    // Check special flags first
    if (row.isAudioMessage === 1) return "voice-memo";
    if (row.isSticker === 1) return "sticker";

    const mime = row.mimeType?.toLowerCase() || "";
    const uti = row.uti?.toLowerCase() || "";
    const filename = row.filename?.toLowerCase() || "";

    // Check for CAF voice memos (Core Audio Format - not browser playable)
    // These often have no mime_type but have UTI com.apple.coreaudio-format
    if (uti.includes("coreaudio") || filename.endsWith(".caf")) {
      return "voice-memo";
    }

    // Check MIME type
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf") return "document";

    // Fallback to UTI
    if (uti.includes("image") || uti.includes("jpeg") || uti.includes("png") || uti.includes("heic")) return "image";
    if (uti.includes("movie") || uti.includes("video") || uti.includes("quicktime")) return "video";
    if (uti.includes("audio") || uti.includes("m4a") || uti.includes("mp3")) return "audio";
    if (uti.includes("pdf")) return "document";

    return "other";
  }

  // Resolve database attachment path to local relative path.
  // Database paths: ~/Library/Messages/Attachments/XX/YY/at_Z_GUID/filename.ext
  // Local paths: data/attachments/XX/YY/at_Z_GUID/filename.ext (preserves at_ prefix)
  private resolveAttachmentPath(dbPath: string | null): string | null {
    if (!dbPath) return null;

    // Match the iMessage attachment path format and preserve the full folder name
    const match = dbPath.match(
      /~\/Library\/Messages\/Attachments\/([a-f0-9]{2})\/([a-f0-9]{2})\/(at_\d+_[A-F0-9-]+)\/(.+)$/i
    );

    if (match) {
      const [, dir1, dir2, folderName, filename] = match;
      return `${dir1}/${dir2}/${folderName}/${filename}`;
    }

    // Alternative: try to extract just the relative path from Attachments/
    const altMatch = dbPath.match(/Attachments\/(.+)$/i);
    if (altMatch) {
      return altMatch[1];
    }

    return null;
  }

  // Fetch attachments for a list of message IDs.
  private getAttachmentsForMessages(messageIds: number[]): Map<number, Attachment[]> {
    if (messageIds.length === 0) return new Map();

    const placeholders = messageIds.map(() => "?").join(",");
    const stmt = this.db.prepare(`
      SELECT
        a.ROWID as rowid,
        a.guid,
        a.filename,
        a.mime_type as mimeType,
        a.uti,
        a.transfer_name as transferName,
        a.total_bytes as totalBytes,
        a.is_sticker as isSticker,
        a.transfer_state as transferState,
        m.is_audio_message as isAudioMessage,
        maj.message_id as messageId
      FROM attachment a
      JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
      JOIN message m ON maj.message_id = m.ROWID
      WHERE maj.message_id IN (${placeholders})
        AND a.hide_attachment = 0
        AND a.transfer_state IN (0, 5)
      ORDER BY a.created_date ASC
    `);

    const rows = stmt.all(...messageIds) as AttachmentRow[];

    // Group by message ID and transform
    const result = new Map<number, Attachment[]>();

    for (const row of rows) {
      const attachment: Attachment = {
        rowid: row.rowid,
        guid: row.guid,
        filename: row.filename,
        mimeType: row.mimeType,
        uti: row.uti,
        transferName: row.transferName,
        totalBytes: row.totalBytes,
        isSticker: row.isSticker === 1,
        isAudioMessage: row.isAudioMessage === 1,
        localPath: this.resolveAttachmentPath(row.filename),
        type: this.classifyAttachmentType(row),
      };

      const existing = result.get(row.messageId);
      if (existing) {
        existing.push(attachment);
      } else {
        result.set(row.messageId, [attachment]);
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

  // Batch fetch last message text for multiple chats in a single query.
  // Returns a Map of chatId -> lastMessageText for efficient lookup.
  private getLastMessageTexts(chatIds: number[]): Map<number, string | null> {
    const result = new Map<number, string | null>();

    if (chatIds.length === 0) return result;

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

    const rows = stmt.all(...chatIds) as { chat_id: number; text: string | null }[];

    for (const row of rows) {
      result.set(row.chat_id, row.text);
    }

    return result;
  }

  // Batch fetch participants for multiple chats in a single query.
  // Returns a Map of chatId -> Handle[] for efficient lookup.
  private getParticipantsForChats(chatIds: number[]): Map<number, Handle[]> {
    const result = new Map<number, Handle[]>();

    if (chatIds.length === 0) return result;

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

    const rows = stmt.all(...chatIds) as HandleWithChatRow[];

    // Group by chatId
    for (const row of rows) {
      const handle: Handle = {
        rowid: row.rowid,
        id: row.id,
        service: row.service,
      };

      const existing = result.get(row.chatId);
      if (existing) {
        existing.push(handle);
      } else {
        result.set(row.chatId, [handle]);
      }
    }

    return result;
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

    const rows = stmt.all(limit, offset) as Omit<ConversationRow, 'lastMessageText'>[];

    // Batch fetch all data in parallel-friendly single queries
    const chatIds = rows.map((row) => row.rowid);
    const participantsByChat = this.getParticipantsForChats(chatIds);
    const lastMessageTexts = this.getLastMessageTexts(chatIds);

    // Transform rows to API response format
    const conversations: Conversation[] = rows.map((row) => ({
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

    // Fetch attachments for these messages
    const messageRowids = messageRows.map((row) => row.rowid);
    const attachmentsByMessage = this.getAttachmentsForMessages(messageRowids);

    // Transform rows to API response format with reactions and attachments
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
      attachments: attachmentsByMessage.get(row.rowid) ?? [],
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
