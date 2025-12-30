import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { getDatabaseInstance } from "./connection";
import { startTimer } from "../perf";

let cacheDb: Database.Database | null = null;

// Cache database path
function getCachePath(): string {
  return path.join(__dirname, "..", "..", "data", "cache.db");
}

// Cache table schema
const CACHE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS conversation_cache (
    chat_id INTEGER PRIMARY KEY,
    last_message_date INTEGER,
    last_message_text TEXT,
    last_message_rowid INTEGER,
    updated_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_cache_date ON conversation_cache(last_message_date DESC);

  CREATE TABLE IF NOT EXISTS cache_metadata (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

// Open cache database, creating schema if needed.
export function openCacheDatabase(): void {
  if (cacheDb) {
    return; // Already open
  }

  const cachePath = getCachePath();
  const exists = fs.existsSync(cachePath);

  cacheDb = new Database(cachePath);
  cacheDb.pragma("journal_mode = WAL");

  if (!exists) {
    cacheDb.exec(CACHE_SCHEMA);
    console.log("Cache database created:", cachePath);
  }
}

// Get cache database instance.
export function getCacheInstance(): Database.Database {
  if (!cacheDb) {
    throw new Error("Cache database not initialized");
  }
  return cacheDb;
}

// Close cache database.
export function closeCacheDatabase(): void {
  if (cacheDb) {
    cacheDb.close();
    cacheDb = null;
  }
}

// Check if cache needs rebuilding.
export function isCacheStale(): boolean {
  if (!cacheDb) return true;

  // Check if cache has any data
  const count = cacheDb
    .prepare("SELECT COUNT(*) as count FROM conversation_cache")
    .get() as { count: number };

  if (count.count === 0) return true;

  // Check last build time
  const lastBuild = cacheDb
    .prepare("SELECT value FROM cache_metadata WHERE key = 'last_build_time'")
    .get() as { value: string } | undefined;

  if (!lastBuild) return true;

  // Cache is stale after 24 hours
  const lastBuildTime = parseInt(lastBuild.value, 10);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  return now - lastBuildTime > maxAge;
}

// Build or rebuild the conversation cache from the source database.
export function buildConversationCache(): { success: boolean; duration: number; chatCount: number } {
  const timer = startTimer("db", "buildConversationCache");
  const startTime = Date.now();

  try {
    const sourceDb = getDatabaseInstance();
    const cache = getCacheInstance();

    // Get last message date and rowid for each chat
    // This is the expensive query we're caching the result of
    const conversationsQuery = `
      SELECT
        cmj.chat_id,
        MAX(cmj.message_date) as last_message_date,
        (
          SELECT message_id FROM chat_message_join
          WHERE chat_id = cmj.chat_id
          ORDER BY message_date DESC
          LIMIT 1
        ) as last_message_rowid
      FROM chat_message_join cmj
      GROUP BY cmj.chat_id
    `;

    const conversations = sourceDb.prepare(conversationsQuery).all() as {
      chat_id: number;
      last_message_date: number;
      last_message_rowid: number;
    }[];

    // Get last message text for each chat in a batch
    const messageRowids = conversations.map((c) => c.last_message_rowid).filter(Boolean);
    const lastMessageTexts = new Map<number, string | null>();

    if (messageRowids.length > 0) {
      const placeholders = messageRowids.map(() => "?").join(",");
      const messagesQuery = `
        SELECT ROWID as rowid, text FROM message
        WHERE ROWID IN (${placeholders})
      `;
      const messages = sourceDb.prepare(messagesQuery).all(...messageRowids) as {
        rowid: number;
        text: string | null;
      }[];

      for (const msg of messages) {
        lastMessageTexts.set(msg.rowid, msg.text);
      }
    }

    // Insert into cache using a transaction
    const now = Date.now();
    const insertStmt = cache.prepare(`
      INSERT OR REPLACE INTO conversation_cache
        (chat_id, last_message_date, last_message_text, last_message_rowid, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = cache.transaction(() => {
      // Clear existing cache
      cache.prepare("DELETE FROM conversation_cache").run();

      // Insert all conversations
      for (const conv of conversations) {
        insertStmt.run(
          conv.chat_id,
          conv.last_message_date,
          lastMessageTexts.get(conv.last_message_rowid) ?? null,
          conv.last_message_rowid,
          now
        );
      }

      // Update metadata
      cache
        .prepare("INSERT OR REPLACE INTO cache_metadata (key, value) VALUES (?, ?)")
        .run("last_build_time", now.toString());
    });

    transaction();

    const duration = Date.now() - startTime;
    timer.end({ chats: conversations.length });

    return { success: true, duration, chatCount: conversations.length };
  } catch (error) {
    timer.end({ error: true });
    console.error("Failed to build conversation cache:", error);
    return { success: false, duration: Date.now() - startTime, chatCount: 0 };
  }
}

// Cached conversation data
export type CachedConversation = {
  chatId: number;
  lastMessageDate: number;
  lastMessageText: string | null;
  lastMessageRowid: number;
};

// Get cached conversations with pagination.
export function getCachedConversations(options: {
  limit?: number;
  offset?: number;
}): { conversations: CachedConversation[]; total: number } {
  const { limit = 50, offset = 0 } = options;
  const cache = getCacheInstance();

  const countResult = cache
    .prepare("SELECT COUNT(*) as count FROM conversation_cache")
    .get() as { count: number };

  const rows = cache
    .prepare(`
      SELECT
        chat_id as chatId,
        last_message_date as lastMessageDate,
        last_message_text as lastMessageText,
        last_message_rowid as lastMessageRowid
      FROM conversation_cache
      ORDER BY last_message_date DESC
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset) as CachedConversation[];

  return {
    conversations: rows,
    total: countResult.count,
  };
}
