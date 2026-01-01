import { useCallback, useRef } from 'react';
import type { VirtuosoHandle, VirtuosoGridHandle } from 'react-virtuoso';
import type { DateIndexResponse } from '@/types/timeline';
import type { Message } from '@/types';
import type { GalleryGridItem } from '@/types/gallery';
import type { NavigationTarget, NavigationResult } from '@/types/navigation';

type UseTimelineNavigationOptions = {
  virtuosoRef: React.RefObject<VirtuosoHandle | VirtuosoGridHandle | null>;
  dateIndex: DateIndexResponse | null;
  items: Message[] | GalleryGridItem[];
  source: 'messages' | 'gallery';
  chatId: number | null;
  // Delegate to useMessageNavigation when provided (for messages source)
  navigateTo?: (target: NavigationTarget) => Promise<NavigationResult>;
  // Deprecated: only used as fallback when navigateTo not provided
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
};

type UseTimelineNavigationReturn = {
  scrollToDate: (targetDate: number) => Promise<void>;
  scrollToMonth: (monthKey: string) => Promise<void>;
};

// Provides scroll-to-date navigation for virtuoso lists.
// For messages, delegates to useMessageNavigation when navigateTo is provided.
// For gallery, finds the month header index and scrolls directly.
export function useTimelineNavigation(
  options: UseTimelineNavigationOptions
): UseTimelineNavigationReturn {
  const { virtuosoRef, dateIndex, items, source, chatId, navigateTo, setMessages } =
    options;

  // Prevent concurrent navigation requests (for gallery and legacy fallback)
  const isNavigatingRef = useRef(false);

  const scrollToDate = useCallback(
    async (targetDate: number) => {
      if (!virtuosoRef.current || !chatId) return;

      if (source === 'messages') {
        // Delegate to useMessageNavigation when available
        if (navigateTo) {
          await navigateTo({ type: 'date', date: targetDate });
          return;
        }

        // Legacy fallback (for backwards compatibility during transition)
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        try {
          const messages = items as Message[];
          const ref = virtuosoRef.current as VirtuosoHandle;

          // Check if target date is within loaded range
          const firstDate = messages[0]?.date ?? 0;
          const lastDate = messages[messages.length - 1]?.date ?? 0;

          if (
            messages.length > 0 &&
            targetDate >= firstDate &&
            targetDate <= lastDate
          ) {
            // Find closest message index
            let closestIndex = 0;
            let minDiff = Infinity;

            for (let i = 0; i < messages.length; i++) {
              const diff = Math.abs(messages[i].date - targetDate);
              if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
              }
            }

            ref.scrollToIndex({
              index: closestIndex,
              align: 'center',
              behavior: 'auto',
            });
          } else if (setMessages) {
            // Target date is outside loaded range - fetch messages around it
            const result = await window.electronAPI.getMessagesAroundDate(
              chatId,
              targetDate,
              50
            );

            if (result.messages.length > 0) {
              setMessages(result.messages);

              // Wait for render, then scroll (double RAF for virtuoso)
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  ref.scrollToIndex({
                    index: result.targetIndex,
                    align: 'center',
                    behavior: 'auto',
                  });
                });
              });
            }
          }
        } finally {
          isNavigatingRef.current = false;
        }
      } else {
        // Gallery - find item closest to target date
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        try {
          const gridItems = items as GalleryGridItem[];
          const ref = virtuosoRef.current as VirtuosoGridHandle;

          // Find target month key
          const targetDateObj = new Date(targetDate);
          const targetMonthKey = `${targetDateObj.getFullYear()}-${String(
            targetDateObj.getMonth() + 1
          ).padStart(2, '0')}`;

          // Try to find the month header first
          let targetIndex = gridItems.findIndex(
            (item) => item.type === 'header' && item.monthKey === targetMonthKey
          );

          // If no header found, find first attachment in or after target month
          if (targetIndex === -1) {
            for (let i = 0; i < gridItems.length; i++) {
              const item = gridItems[i];
              if (item.type === 'attachment' && item.data.date >= targetDate) {
                targetIndex = i;
                break;
              }
            }
          }

          if (targetIndex !== -1) {
            ref.scrollToIndex({
              index: targetIndex,
              align: 'start',
            });
          }
        } finally {
          isNavigatingRef.current = false;
        }
      }
    },
    [virtuosoRef, chatId, items, source, navigateTo, setMessages]
  );

  const scrollToMonth = useCallback(
    async (monthKey: string) => {
      if (!dateIndex) return;

      const entry = dateIndex.entries.find((e) => e.monthKey === monthKey);
      if (entry) {
        await scrollToDate(entry.firstDate);
      }
    },
    [dateIndex, scrollToDate]
  );

  return { scrollToDate, scrollToMonth };
}
