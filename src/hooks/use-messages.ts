import { useState, useEffect, useCallback, useRef } from "react";
import type { Message } from "@/types";

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
};

// Fetch and manage messages for a conversation with cursor pagination.
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const { chatId, initialLimit = 50 } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

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
        const result = await window.electronAPI.getMessages(opts);

        if (prepend) {
          // Prepend older messages at the beginning
          setMessages((prev) => [...result.messages, ...prev]);
        } else {
          setMessages(result.messages);
        }

        setHasMore(result.hasMore);

        // Track oldest message date for pagination cursor
        if (result.messages.length > 0) {
          oldestDateRef.current = result.messages[0].date;
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

  // Fetch messages when chatId changes.
  useEffect(() => {
    if (chatId === null) {
      setMessages([]);
      setHasMore(false);
      oldestDateRef.current = undefined;
      return;
    }

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
  };
}
