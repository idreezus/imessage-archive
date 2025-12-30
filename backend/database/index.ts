export {
  openDatabase,
  closeDatabase,
  getDatabaseInstance,
  isDatabaseOpen,
} from "./connection";

export {
  APPLE_EPOCH_OFFSET_MS,
  appleToJsTimestamp,
  jsToAppleTimestamp,
} from "./timestamps";

export {
  openCacheDatabase,
  closeCacheDatabase,
  getCacheInstance,
  isCacheStale,
  buildConversationCache,
  getCachedConversations,
  type CachedConversation,
} from "./cache";
