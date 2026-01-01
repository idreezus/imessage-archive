import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { Message } from '@/types';
import type { NavigationTarget, NavigationResult } from '@/types/navigation';

type UseMessageNavigationOptions = {
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  messages: Message[];
  chatId: number | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setFirstItemIndex?: React.Dispatch<React.SetStateAction<number>>;
};

type UseMessageNavigationReturn = {
  navigateTo: (target: NavigationTarget) => Promise<NavigationResult>;
  isNavigating: boolean;
  highlightedRowId: number | null;
};

// Highlight duration in milliseconds
const HIGHLIGHT_DURATION_MS = 2000;

// Base firstItemIndex for Virtuoso (same as use-messages.ts)
const BASE_FIRST_ITEM_INDEX = 100000;

// Unified message navigation hook for search results and timeline navigation
// Handles both instant scroll (target in loaded range) and fetch-scroll (target not loaded)
export function useMessageNavigation(
  options: UseMessageNavigationOptions
): UseMessageNavigationReturn {
  const { virtuosoRef, messages, chatId, setMessages, setFirstItemIndex } =
    options;

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [highlightedRowId, setHighlightedRowId] = useState<number | null>(null);

  // Refs for concurrency control and cleanup
  const isNavigatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup function for timers
  const clearHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHighlightTimer();
      abortControllerRef.current?.abort();
    };
  }, [clearHighlightTimer]);

  // Set highlight with automatic cleanup after duration
  const setHighlightWithTimeout = useCallback(
    (rowId: number | null) => {
      clearHighlightTimer();
      setHighlightedRowId(rowId);

      if (rowId !== null) {
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedRowId(null);
        }, HIGHLIGHT_DURATION_MS);
      }
    },
    [clearHighlightTimer]
  );

  // Scroll to index using double RAF pattern for Virtuoso
  const scrollToIndexWithRAF = useCallback(
    (index: number) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({
            index,
            align: 'center',
            behavior: 'auto',
          });
        });
      });
    },
    [virtuosoRef]
  );

  // Find message index in current messages by rowId
  const findMessageIndex = useCallback(
    (rowId: number): number => {
      return messages.findIndex((m) => m.rowid === rowId);
    },
    [messages]
  );

  // Find closest message index for a date
  const findClosestDateIndex = useCallback(
    (targetDate: number): number => {
      if (messages.length === 0) return -1;

      let closestIndex = 0;
      let minDiff = Infinity;

      for (let i = 0; i < messages.length; i++) {
        const diff = Math.abs(messages[i].date - targetDate);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      return closestIndex;
    },
    [messages]
  );

  // Check if target date is within loaded message range
  const isDateInLoadedRange = useCallback(
    (targetDate: number): boolean => {
      if (messages.length === 0) return false;
      const firstDate = messages[0].date;
      const lastDate = messages[messages.length - 1].date;
      return targetDate >= firstDate && targetDate <= lastDate;
    },
    [messages]
  );

  // Main navigation function
  const navigateTo = useCallback(
    async (target: NavigationTarget): Promise<NavigationResult> => {
      if (!chatId || !virtuosoRef.current) {
        return { success: false, targetRowId: null, found: false };
      }

      // Cancel any in-flight navigation
      if (isNavigatingRef.current) {
        abortControllerRef.current?.abort();
      }

      // Set up new abort controller
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      isNavigatingRef.current = true;
      setIsNavigating(true);
      clearHighlightTimer();

      try {
        // STEP 1: Check if target is already in loaded messages
        if (target.type === 'rowId') {
          const existingIndex = findMessageIndex(target.rowId);
          if (existingIndex !== -1) {
            // Instant scroll - message is already loaded
            scrollToIndexWithRAF(existingIndex);
            setHighlightWithTimeout(target.rowId);
            return { success: true, targetRowId: target.rowId, found: true };
          }
        } else if (target.type === 'date') {
          if (isDateInLoadedRange(target.date)) {
            // Find closest message and scroll
            const closestIndex = findClosestDateIndex(target.date);
            if (closestIndex !== -1) {
              const targetRowId = messages[closestIndex]?.rowid ?? null;
              scrollToIndexWithRAF(closestIndex);
              setHighlightWithTimeout(targetRowId);
              return { success: true, targetRowId, found: true };
            }
          }
        }

        // STEP 2: Fetch messages from API
        if (signal.aborted) {
          return { success: false, targetRowId: null, found: false };
        }

        const result = await window.electronAPI.getMessagesAround({
          chatId,
          target,
          contextCount: 50,
        });

        // Check if navigation was aborted during fetch
        if (signal.aborted) {
          return { success: false, targetRowId: null, found: false };
        }

        // STEP 3: Handle result
        if (result.messages.length === 0) {
          toast.info('No messages found for this location');
          return { success: false, targetRowId: null, found: false };
        }

        // STEP 4: Update messages and scroll to target
        setMessages(result.messages);

        // Scroll to target after Virtuoso processes new messages
        scrollToIndexWithRAF(result.targetIndex);

        // Set highlight
        if (result.targetRowId !== null) {
          setHighlightWithTimeout(result.targetRowId);
        }

        // Handle "not found" case with toast
        if (!result.found) {
          toast.info('Message not found. Showing nearby messages.');
        }

        return {
          success: true,
          targetRowId: result.targetRowId,
          found: result.found,
        };
      } catch (error) {
        // Only log and show error if not aborted
        if (!signal.aborted) {
          console.error('Navigation failed:', error);
          toast.error('Failed to navigate to message');
        }
        return { success: false, targetRowId: null, found: false };
      } finally {
        isNavigatingRef.current = false;
        setIsNavigating(false);
      }
    },
    [
      chatId,
      virtuosoRef,
      messages,
      setMessages,
      setFirstItemIndex,
      clearHighlightTimer,
      findMessageIndex,
      findClosestDateIndex,
      isDateInLoadedRange,
      scrollToIndexWithRAF,
      setHighlightWithTimeout,
    ]
  );

  return {
    navigateTo,
    isNavigating,
    highlightedRowId,
  };
}
