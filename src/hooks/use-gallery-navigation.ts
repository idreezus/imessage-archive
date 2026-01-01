import { useCallback, useRef, useState } from 'react';
import type { VirtuosoGridHandle } from 'react-virtuoso';
import type { GalleryAttachment, GalleryFilters } from '@/types/gallery';

type HasMore = {
  before: boolean;
  after: boolean;
};

type UseGalleryNavigationOptions = {
  virtuosoGridRef: React.RefObject<VirtuosoGridHandle | null>;
  attachments: GalleryAttachment[];
  chatId: number | null;
  setAttachments: React.Dispatch<React.SetStateAction<GalleryAttachment[]>>;
  setHasMore: React.Dispatch<React.SetStateAction<HasMore>>;
  filters: GalleryFilters;
};

type UseGalleryNavigationReturn = {
  navigateToDate: (date: number) => Promise<number | undefined>;
  isNavigating: boolean;
};

// Handles timeline scrubber navigation for gallery view
export function useGalleryNavigation(
  options: UseGalleryNavigationOptions
): UseGalleryNavigationReturn {
  const {
    virtuosoGridRef,
    attachments,
    chatId,
    setAttachments,
    setHasMore,
    filters,
  } = options;

  const [isNavigating, setIsNavigating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if date is in loaded range
  const isDateInLoadedRange = useCallback(
    (targetDate: number): boolean => {
      if (attachments.length === 0) return false;
      const firstDate = attachments[0].date;
      const lastDate = attachments[attachments.length - 1].date;
      // Handle both asc and desc sorting
      return (
        targetDate >= Math.min(firstDate, lastDate) &&
        targetDate <= Math.max(firstDate, lastDate)
      );
    },
    [attachments]
  );

  // Find closest attachment index for a date
  const findClosestDateIndex = useCallback(
    (targetDate: number): number => {
      if (attachments.length === 0) return -1;

      let closestIndex = 0;
      let minDiff = Infinity;

      for (let i = 0; i < attachments.length; i++) {
        const diff = Math.abs(attachments[i].date - targetDate);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      return closestIndex;
    },
    [attachments]
  );

  // Scroll using double RAF pattern for timing
  const scrollToIndexWithRAF = useCallback(
    (index: number) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          virtuosoGridRef.current?.scrollToIndex({
            index,
            align: 'start',
          });
        });
      });
    },
    [virtuosoGridRef]
  );

  // Navigate to a specific date
  const navigateToDate = useCallback(
    async (date: number): Promise<number | undefined> => {
      if (chatId === null || isNavigating) return undefined;

      // Cancel previous navigation
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Check if date is in loaded range first
      if (isDateInLoadedRange(date)) {
        const closestIndex = findClosestDateIndex(date);
        if (closestIndex !== -1) {
          scrollToIndexWithRAF(closestIndex);
          return closestIndex;
        }
      }

      // Fetch from API
      setIsNavigating(true);

      try {
        const result = await window.electronAPI.getGalleryAround({
          chatId,
          target: { type: 'date', date },
          contextCount: 50,
          types: filters.types === 'all' ? undefined : filters.types,
          direction: filters.direction !== 'all' ? filters.direction : undefined,
        });

        if (abortControllerRef.current?.signal.aborted) {
          return undefined;
        }

        // Update attachments and hasMore states
        setAttachments(result.attachments);
        setHasMore({
          before: result.hasMore.before,
          after: result.hasMore.after,
        });

        // Scroll to target after state update
        scrollToIndexWithRAF(result.targetIndex);

        return result.targetIndex;
      } catch (err) {
        console.error('Navigation failed:', err);
        return undefined;
      } finally {
        setIsNavigating(false);
      }
    },
    [
      chatId,
      isNavigating,
      isDateInLoadedRange,
      findClosestDateIndex,
      scrollToIndexWithRAF,
      filters,
      setAttachments,
      setHasMore,
    ]
  );

  return {
    navigateToDate,
    isNavigating,
  };
}
