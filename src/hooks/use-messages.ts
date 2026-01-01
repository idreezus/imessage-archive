import { useState, useEffect, useCallback, useRef } from "react";
import type { Message } from "@/types";
import { startTimer } from "@/lib/perf";

type UseMessagesOptions = {
  chatId: number | null;
  initialLimit?: number;
};

type UseMessagesReturn = {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  /** The chatId these messages belong to (for consistency checking) */
  loadedChatId: number | null;
  /** Starting index for virtuoso firstItemIndex prop (decreases when prepending) */
  firstItemIndex: number;
  /** Setter for firstItemIndex (used by navigation to reset scroll position) */
  setFirstItemIndex: React.Dispatch<React.SetStateAction<number>>;
};

// Cache for previously loaded messages - persists across hook instances
type CacheEntry = {
  messages: Message[];
  hasMore: boolean;
  oldestDate: number | undefined;
  timestamp: number;
};

const messageCache = new Map<number, CacheEntry>();
const CACHE_MAX_SIZE = 10; // Keep last 10 chats in memory
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes before background refresh

// Evict oldest entries when cache is full
function evictOldestCache() {
  if (messageCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: number | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of messageCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      messageCache.delete(oldestKey);
    }
  }
}

// Fetch and manage messages for a conversation with cursor pagination.
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const { chatId, initialLimit = 50 } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedChatId, setLoadedChatId] = useState<number | null>(null);
  // Starting index for virtuoso - decreases when prepending older messages
  const [firstItemIndex, setFirstItemIndex] = useState(100000);

  // Track oldest message date for cursor pagination
  const oldestDateRef = useRef<number | undefined>(undefined);

  // Fetch messages from main process via IPC.
  const fetchMessages = useCallback(
    async (
      opts: { chatId: number; limit: number; beforeDate?: number },
      prepend = false
    ) => {
      if (!window.electronAPI) {
        setError(new Error("Electron API not available"));
        return;
      }

      setIsLoading(true);

      try {
        const timer = startTimer("ipc", "getMessages");
        const result = await window.electronAPI.getMessages(opts);
        timer.end({ chatId: opts.chatId, limit: opts.limit, messages: result.messages.length });

        if (prepend) {
          // Prepend older messages and adjust firstItemIndex for stable scroll
          setFirstItemIndex((prev) => prev - result.messages.length);
          setMessages((prev) => [...result.messages, ...prev]);
        } else {
          setMessages(result.messages);
        }

        setHasMore(result.hasMore);
        setLoadedChatId(opts.chatId);

        // Track oldest message date for pagination cursor
        const newOldestDate = result.messages.length > 0 ? result.messages[0].date : oldestDateRef.current;
        if (result.messages.length > 0) {
          oldestDateRef.current = result.messages[0].date;
        }

        // Save to cache (only for initial loads, not prepends)
        if (!prepend) {
          evictOldestCache();
          messageCache.set(opts.chatId, {
            messages: result.messages,
            hasMore: result.hasMore,
            oldestDate: newOldestDate,
            timestamp: Date.now(),
          });
        }

        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to fetch messages")
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Fetch messages when chatId changes - use cache for instant display.
  useEffect(() => {
    if (chatId === null) {
      setMessages([]);
      setHasMore(false);
      setLoadedChatId(null);
      setFirstItemIndex(100000);
      oldestDateRef.current = undefined;
      return;
    }

    // Check cache first for instant display
    const cached = messageCache.get(chatId);
    const now = Date.now();

    if (cached) {
      // Restore from cache immediately (no skeleton!)
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setLoadedChatId(chatId);
      setFirstItemIndex(100000);
      oldestDateRef.current = cached.oldestDate;

      // If cache is fresh enough, skip refetch entirely
      if (now - cached.timestamp < CACHE_TTL_MS) {
        return;
      }

      // Cache is stale - refresh in background (no loading state)
      const bgTimer = startTimer("ipc", "getMessages.background");
      window.electronAPI?.getMessages({ chatId, limit: initialLimit }).then((result) => {
        bgTimer.end({ chatId, messages: result.messages.length });
        setMessages(result.messages);
        setHasMore(result.hasMore);

        const newOldestDate = result.messages.length > 0 ? result.messages[0].date : undefined;
        oldestDateRef.current = newOldestDate;

        // Update cache
        messageCache.set(chatId, {
          messages: result.messages,
          hasMore: result.hasMore,
          oldestDate: newOldestDate,
          timestamp: Date.now(),
        });
      });
      return;
    }

    // No cache - clear and fetch with loading state
    setMessages([]);
    setHasMore(false);
    setLoadedChatId(null);
    setFirstItemIndex(100000);
    oldestDateRef.current = undefined;

    fetchMessages({ chatId, limit: initialLimit });
  }, [chatId, initialLimit, fetchMessages]);

  // Load older messages using cursor pagination.
  const loadMore = useCallback(() => {
    if (chatId === null || !hasMore || isLoading) return;

    fetchMessages(
      {
        chatId,
        limit: initialLimit,
        beforeDate: oldestDateRef.current,
      },
      true
    );
  }, [chatId, hasMore, isLoading, initialLimit, fetchMessages]);

  // Reset and refetch messages for current conversation.
  const refresh = useCallback(() => {
    if (chatId === null) return;

    oldestDateRef.current = undefined;
    fetchMessages({ chatId, limit: initialLimit });
  }, [chatId, initialLimit, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    setMessages,
    loadedChatId,
    firstItemIndex,
    setFirstItemIndex,
  };
}
