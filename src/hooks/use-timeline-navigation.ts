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
  // Required for messages source - delegates to useMessageNavigation
  navigateTo?: (target: NavigationTarget) => Promise<NavigationResult>;
};

type UseTimelineNavigationReturn = {
  scrollToDate: (targetDate: number) => Promise<void>;
  scrollToMonth: (monthKey: string) => Promise<void>;
};

// Provides scroll-to-date navigation for virtuoso lists.
// For messages, delegates to useMessageNavigation.
// For gallery, finds the month header index and scrolls directly.
export function useTimelineNavigation(
  options: UseTimelineNavigationOptions
): UseTimelineNavigationReturn {
  const { virtuosoRef, dateIndex, items, source, chatId, navigateTo } = options;

  // Prevent concurrent navigation requests (for gallery)
  const isNavigatingRef = useRef(false);

  const scrollToDate = useCallback(
    async (targetDate: number) => {
      if (!virtuosoRef.current || !chatId) return;

      if (source === 'messages') {
        // Delegate to useMessageNavigation
        if (navigateTo) {
          await navigateTo({ type: 'date', date: targetDate });
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
    [virtuosoRef, chatId, items, source, navigateTo]
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
