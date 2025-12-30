import { getDatabaseInstance } from "../database/connection";
import { appleToJsTimestamp } from "../database/timestamps";
import { getCachedConversations, type CachedConversation } from "../database/cache";
import { startTimer } from "../perf";
import {
  Handle,
  HandleRow,
  HandleWithChatRow,
  Conversation,
  ConversationRow,
  ConversationsOptions,
} from "./types";

// Fetch handles for autocomplete with optional search and limit.
export function getAllHandles(
  options: { query?: string; limit?: number } = {}
): Handle[] {
  const db = getDatabaseInstance();
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

  const stmt = db.prepare(sql);
  return stmt.all(...params) as HandleRow[];
}

// Fetch chats for filter dropdown with optional search and limit.
export function getAllChats(
  options: { query?: string; limit?: number } = {}
): { rowid: number; displayName: string | null; chatIdentifier: string; isGroup: boolean }[] {
  const db = getDatabaseInstance();
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

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as {
    rowid: number;
    displayName: string | null;
    chatIdentifier: string;
    style: number;
  }[];

  return rows.map((row) => ({
    rowid: row.rowid,
    displayName: row.displayName,
    chatIdentifier: row.chatIdentifier,
    isGroup: row.style === 43,
  }));
}

// Fetch participants (handles) for a given chat.
export function getParticipantsForChat(chatId: number): Handle[] {
  const db = getDatabaseInstance();
  const stmt = db.prepare(`
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

// Batch fetch participants for multiple chats in a single query.
export function getParticipantsForChats(chatIds: number[]): Map<number, Handle[]> {
  const result = new Map<number, Handle[]>();

  if (chatIds.length === 0) return result;

  const db = getDatabaseInstance();
  const placeholders = chatIds.map(() => "?").join(",");
  const stmt = db.prepare(`
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

// Batch fetch last message text for multiple chats in a single query.
export function getLastMessageTexts(chatIds: number[]): Map<number, string | null> {
  const result = new Map<number, string | null>();

  if (chatIds.length === 0) return result;

  const db = getDatabaseInstance();
  const placeholders = chatIds.map(() => "?").join(",");
  const stmt = db.prepare(`
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

// Fetch paginated list of conversations with last message preview.
// Uses the pre-built conversation cache for fast startup.
export function getConversations(options: ConversationsOptions = {}): {
  conversations: Conversation[];
  total: number;
} {
  const db = getDatabaseInstance();
  const { limit = 50, offset = 0 } = options;

  // Get cached conversation data (last_message_date, last_message_text already computed)
  const cacheTimer = startTimer("db", "getConversations.cache");
  const { conversations: cachedConversations, total } = getCachedConversations({
    limit,
    offset,
  });
  cacheTimer.end({ cached: cachedConversations.length });

  // Get chat metadata from source database
  const chatIds = cachedConversations.map((c) => c.chatId);

  if (chatIds.length === 0) {
    return { conversations: [], total };
  }

  const metadataTimer = startTimer("db", "getConversations.metadata");
  const placeholders = chatIds.map(() => "?").join(",");
  const chatMetadata = db
    .prepare(
      `
      SELECT
        ROWID as rowid,
        guid,
        chat_identifier as chatIdentifier,
        display_name as displayName,
        style
      FROM chat
      WHERE ROWID IN (${placeholders})
    `
    )
    .all(...chatIds) as {
    rowid: number;
    guid: string;
    chatIdentifier: string;
    displayName: string | null;
    style: number;
  }[];
  metadataTimer.end({ chats: chatMetadata.length });

  // Create lookup map for chat metadata
  const metadataByChat = new Map(chatMetadata.map((c) => [c.rowid, c]));

  // Get participants
  const participantsTimer = startTimer("db", "getConversations.participants");
  const participantsByChat = getParticipantsForChats(chatIds);
  participantsTimer.end({ chats: chatIds.length });

  // Transform to API response format (maintaining cache order which is sorted by date)
  const transformTimer = startTimer("db", "getConversations.transform");
  const conversations: Conversation[] = [];

  for (const cached of cachedConversations) {
    const metadata = metadataByChat.get(cached.chatId);
    if (!metadata) continue; // Skip if metadata not found

    conversations.push({
      rowid: cached.chatId,
      guid: metadata.guid,
      chatIdentifier: metadata.chatIdentifier,
      displayName: metadata.displayName,
      style: metadata.style,
      isGroup: metadata.style === 43,
      lastMessageDate: appleToJsTimestamp(cached.lastMessageDate),
      lastMessageText: cached.lastMessageText,
      participants: participantsByChat.get(cached.chatId) ?? [],
    });
  }
  transformTimer.end({ conversations: conversations.length });

  return {
    conversations,
    total,
  };
}

// Fetch single conversation by ID.
export function getConversationById(chatId: number): Conversation | null {
  const db = getDatabaseInstance();
  const stmt = db.prepare(`
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

  const participants = getParticipantsForChat(row.rowid);

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
