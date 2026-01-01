import { useCallback } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { DateIndexResponse } from '@/types/timeline';
import type { NavigationTarget, NavigationResult } from '@/types/navigation';

type UseTimelineNavigationOptions = {
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  dateIndex: DateIndexResponse | null;
  chatId: number | null;
  navigateTo: (target: NavigationTarget) => Promise<NavigationResult>;
};

type UseTimelineNavigationReturn = {
  scrollToDate: (targetDate: number) => Promise<void>;
  scrollToMonth: (monthKey: string) => Promise<void>;
};

// Provides scroll-to-date navigation for virtuoso lists (messages only)
// Gallery timeline navigation is handled directly via navigateToDate in context
export function useTimelineNavigation(
  options: UseTimelineNavigationOptions
): UseTimelineNavigationReturn {
  const { virtuosoRef, dateIndex, chatId, navigateTo } = options;

  const scrollToDate = useCallback(
    async (targetDate: number) => {
      if (!virtuosoRef.current || !chatId) return;
      await navigateTo({ type: 'date', date: targetDate });
    },
    [virtuosoRef, chatId, navigateTo]
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
