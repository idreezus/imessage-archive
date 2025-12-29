import { useState, useEffect, useCallback } from "react";
import type { Conversation } from "@/types";

type UseConversationsOptions = {
  initialLimit?: number;
};

type UseConversationsReturn = {
  conversations: Conversation[];
  isLoading: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
};

// Fetch and manage paginated conversation list from IPC.
export function useConversations(
  options: UseConversationsOptions = {}
): UseConversationsReturn {
  const { initialLimit = 50 } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Fetch conversations from main process via IPC.
  const fetchConversations = useCallback(
    async (opts: { limit: number; offset: number }, append = false) => {
      if (!window.electronAPI) {
        setError(new Error("Electron API not available"));
        setIsLoading(false);
        return;
      }

      try {
        const result = await window.electronAPI.getConversations(opts);

        if (append) {
          setConversations((prev) => [...prev, ...result.conversations]);
        } else {
          setConversations(result.conversations);
        }

        setTotal(result.total);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to fetch conversations")
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchConversations({ limit: initialLimit, offset: 0 });
  }, [fetchConversations, initialLimit]);

  // Load next page of conversations.
  const loadMore = useCallback(() => {
    if (conversations.length >= total || isLoading) return;

    const newOffset = offset + initialLimit;
    setOffset(newOffset);
    setIsLoading(true);
    fetchConversations({ limit: initialLimit, offset: newOffset }, true);
  }, [conversations.length, total, isLoading, offset, initialLimit, fetchConversations]);

  // Reset and refetch from beginning.
  const refresh = useCallback(() => {
    setOffset(0);
    setIsLoading(true);
    fetchConversations({ limit: initialLimit, offset: 0 });
  }, [fetchConversations, initialLimit]);

  return {
    conversations,
    isLoading,
    error,
    total,
    hasMore: conversations.length < total,
    loadMore,
    refresh,
  };
}
