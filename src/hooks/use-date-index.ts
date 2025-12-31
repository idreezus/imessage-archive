import { useState, useEffect, useMemo } from 'react';
import { LRUCache } from '@/lib/lru-cache';
import type {
  DateIndexResponse,
  DateIndexEntry,
  TimelineTick,
} from '@/types/timeline';

type UseDateIndexOptions = {
  chatId: number | null;
  source: 'messages' | 'gallery';
};

type UseDateIndexReturn = {
  dateIndex: DateIndexResponse | null;
  ticks: TimelineTick[];
  isLoading: boolean;
  error: Error | null;
};

// Cache date indices across hook instances (lightweight data, 20 entries)
const dateIndexCache = new LRUCache<string, DateIndexResponse>(20);

// Month abbreviations for tick labels
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Generate timeline ticks from date index entries (Google Photos style)
// All months are shown, year labels appear at year boundaries
function generateTicks(entries: DateIndexEntry[]): TimelineTick[] {
  if (entries.length === 0) return [];

  return entries.map((entry) => ({
    key: entry.monthKey,
    // Full label shown on hover: "Jan 2024"
    label: `${MONTH_LABELS[entry.month - 1]} ${entry.year}`,
    // Year label only shown at year boundaries (January)
    yearLabel: entry.month === 1 ? String(entry.year) : undefined,
    date: entry.firstDate,
    granularity: 'month' as const,
    isYearStart: entry.month === 1,
  }));
}

// Preloads and caches date index for timeline scrubber navigation.
// Automatically determines granularity based on date range (years if >2 years, months otherwise).
export function useDateIndex(options: UseDateIndexOptions): UseDateIndexReturn {
  const { chatId, source } = options;

  const [dateIndex, setDateIndex] = useState<DateIndexResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (chatId === null) {
      setDateIndex(null);
      setError(null);
      return;
    }

    const cacheKey = `${source}-${chatId}`;
    const cached = dateIndexCache.get(cacheKey);

    if (cached) {
      setDateIndex(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const fetchFn =
      source === 'messages'
        ? window.electronAPI.getDateIndex
        : window.electronAPI.getGalleryDateIndex;

    fetchFn(chatId)
      .then((response) => {
        dateIndexCache.set(cacheKey, response);
        setDateIndex(response);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to fetch date index:', err);
        setError(
          err instanceof Error ? err : new Error('Failed to fetch date index')
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [chatId, source]);

  // Generate timeline ticks (all months, Google Photos style)
  const ticks = useMemo(
    () => (dateIndex ? generateTicks(dateIndex.entries) : []),
    [dateIndex]
  );

  return { dateIndex, ticks, isLoading, error };
}
