import { useState, useCallback, useRef } from 'react';
import type { ListRange } from 'react-virtuoso';
import type { Message } from '@/types';
import type { GalleryAttachment } from '@/types/gallery';

type UseVisibleDateRangeOptions = {
  items: Message[] | GalleryAttachment[];
  source: 'messages' | 'gallery';
};

type UseVisibleDateRangeReturn = {
  visibleMonthKey: string | null;
  handleRangeChanged: (range: ListRange) => void;
};

// Extract date from item based on source type
function getItemDate(
  item: Message | GalleryAttachment,
  source: 'messages' | 'gallery'
): number | null {
  if (source === 'messages') {
    return (item as Message).date;
  }
  return (item as GalleryAttachment).date;
}

// Convert date to monthKey format "YYYY-MM"
function dateToMonthKey(date: number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Tracks the currently visible month in the viewport based on rangeChanged callback.
// Uses debouncing to avoid excessive re-renders during scrolling.
export function useVisibleDateRange(
  options: UseVisibleDateRangeOptions
): UseVisibleDateRangeReturn {
  const { items, source } = options;

  const [visibleMonthKey, setVisibleMonthKey] = useState<string | null>(null);

  // Debounce updates to avoid excessive re-renders during fast scrolling
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (items.length === 0) return;

        // Use middle of visible range for current position
        const midIndex = Math.floor((range.startIndex + range.endIndex) / 2);
        const clampedIndex = Math.min(Math.max(0, midIndex), items.length - 1);
        const item = items[clampedIndex];

        if (item) {
          const date = getItemDate(item, source);
          if (date) {
            setVisibleMonthKey(dateToMonthKey(date));
          }
        }
      }, 50);
    },
    [items, source]
  );

  return { visibleMonthKey, handleRangeChanged };
}
