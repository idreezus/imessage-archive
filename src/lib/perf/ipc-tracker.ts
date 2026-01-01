import { isPerfEnabled } from "./config";
import { startTimer } from "./logger";

/**
 * Wrap an async function with performance timing.
 * Returns the original function unchanged when perf is disabled.
 */
export function trackIpcCall<T extends unknown[], R>(
  methodName: string,
  method: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  if (!isPerfEnabled()) return method;

  return async (...args: T) => {
    const timer = startTimer("ipc", methodName);
    try {
      const result = await method(...args);
      timer.end();
      return result;
    } catch (error) {
      timer.end({ error: true });
      throw error;
    }
  };
}

/**
 * Create a tracked version of the entire electronAPI.
 * All IPC calls will be automatically timed when perf is enabled.
 */
export function createTrackedApi() {
  const api = window.electronAPI;
  if (!api) return api;
  if (!isPerfEnabled()) return api;

  return {
    getConversations: trackIpcCall(
      "getConversations",
      api.getConversations.bind(api)
    ),
    getMessages: trackIpcCall("getMessages", api.getMessages.bind(api)),
    getConversationById: trackIpcCall(
      "getConversationById",
      api.getConversationById.bind(api)
    ),
    getDatabaseStatus: trackIpcCall(
      "getDatabaseStatus",
      api.getDatabaseStatus.bind(api)
    ),
    search: trackIpcCall("search", api.search.bind(api)),
    getSearchStatus: trackIpcCall(
      "getSearchStatus",
      api.getSearchStatus.bind(api)
    ),
    rebuildSearchIndex: trackIpcCall(
      "rebuildSearchIndex",
      api.rebuildSearchIndex.bind(api)
    ),
    getHandles: trackIpcCall("getHandles", api.getHandles.bind(api)),
    getChatsForFilter: trackIpcCall(
      "getChatsForFilter",
      api.getChatsForFilter.bind(api)
    ),
    getAttachmentFileUrl: trackIpcCall(
      "getAttachmentFileUrl",
      api.getAttachmentFileUrl.bind(api)
    ),
  } as typeof api;
}
