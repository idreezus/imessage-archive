import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LRUCache } from '@/lib/lru-cache';
import { startTimer } from '@/lib/perf';
import type {
  GalleryAttachment,
  GalleryFilters,
  GalleryStats,
  GallerySortBy,
  GallerySortOrder,
  GalleryDatePreset,
  GetGalleryAroundResult,
} from '@/types/gallery';
import { defaultGalleryFilters } from '@/types/gallery';
import type { AttachmentType } from '@/types';

const DEBOUNCE_MS = 150;
const CACHE_SIZE = 10;
const DEFAULT_CONTEXT_COUNT = 50;

// Helper to get date range from preset
function getDateRangeFromPreset(preset: GalleryDatePreset): {
  from: Date | null;
  to: Date | null;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (preset) {
    case '7days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { from, to: endOfToday };
    }
    case '30days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return { from, to: endOfToday };
    }
    case 'year': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to: endOfToday };
    }
    case 'custom':
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

type UseGalleryAttachmentsOptions = {
  chatId: number | null;
  enabled?: boolean;
};

type HasMore = {
  before: boolean;
  after: boolean;
};

type UseGalleryAttachmentsReturn = {
  // Data
  attachments: GalleryAttachment[];
  stats: GalleryStats | null;
  isLoading: boolean;
  error: Error | null;

  // Pagination
  hasMore: HasMore;
  loadMore: () => void;
  loadEarlier: () => void;

  // Filters
  filters: GalleryFilters;
  isFiltered: boolean;
  setTypeFilter: (types: AttachmentType[] | 'all') => void;
  setDirection: (direction: 'all' | 'sent' | 'received') => void;
  setDateRange: (
    range:
      | { from: Date | null; to: Date | null; preset: GalleryDatePreset | null }
      | GalleryDatePreset
  ) => void;
  clearFilters: () => void;

  // Sort
  sortBy: GallerySortBy;
  sortOrder: GallerySortOrder;
  setSortBy: (sort: GallerySortBy) => void;
  toggleSortOrder: () => void;

  // Actions
  refresh: () => void;
  reset: () => void;

  // For navigation hook - internal setters
  setAttachments: React.Dispatch<React.SetStateAction<GalleryAttachment[]>>;
  setHasMore: React.Dispatch<React.SetStateAction<HasMore>>;
};

// Data fetching hook for gallery attachments with filters, sort, and pagination
export function useGalleryAttachments(
  options: UseGalleryAttachmentsOptions
): UseGalleryAttachmentsReturn {
  const { chatId, enabled = true } = options;

  // Data state
  const [attachments, setAttachments] = useState<GalleryAttachment[]>([]);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState<HasMore>({ before: false, after: false });

  // Filter state
  const [filters, setFilters] = useState<GalleryFilters>(defaultGalleryFilters);

  // Sort state
  const [sortBy, setSortByState] = useState<GallerySortBy>('date');
  const [sortOrder, setSortOrder] = useState<GallerySortOrder>('desc');

  // Refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new LRUCache<string, GetGalleryAroundResult>(CACHE_SIZE));
  const isInitialLoadRef = useRef(true);

  // Check if any filter is active
  const isFiltered = useMemo(() => {
    return (
      filters.types !== 'all' ||
      filters.direction !== 'all' ||
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null
    );
  }, [filters]);

  // Generate cache key
  const getCacheKey = useCallback(
    (date: number) => {
      return JSON.stringify({
        chatId,
        filters: {
          types: filters.types,
          direction: filters.direction,
          dateFrom: filters.dateRange.from?.getTime(),
          dateTo: filters.dateRange.to?.getTime(),
        },
        sortBy,
        sortOrder,
        date,
      });
    },
    [chatId, filters, sortBy, sortOrder]
  );

  // Execute initial fetch (from newest)
  const executeInitialFetch = useCallback(async () => {
    if (chatId === null) return;

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    const timer = startTimer('ipc', 'getGalleryAttachments.initial');

    try {
      // Fetch from newest (current time)
      const targetDate = Date.now();

      // Parallel fetch: attachments and stats
      const [aroundResult, statsResult] = await Promise.all([
        window.electronAPI.getGalleryAround({
          chatId,
          target: { type: 'date', date: targetDate },
          contextCount: DEFAULT_CONTEXT_COUNT,
          types: filters.types === 'all' ? undefined : filters.types,
          direction: filters.direction !== 'all' ? filters.direction : undefined,
        }),
        window.electronAPI.getGalleryStats({
          chatId,
          direction: filters.direction !== 'all' ? filters.direction : undefined,
          dateFrom: filters.dateRange.from?.getTime(),
          dateTo: filters.dateRange.to?.getTime(),
        }),
      ]);

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) return;

      timer.end({
        chatId,
        count: aroundResult.attachments.length,
        hasMore: aroundResult.hasMore,
      });

      // Cache result
      const cacheKey = getCacheKey(targetDate);
      cacheRef.current.set(cacheKey, aroundResult);

      setAttachments(aroundResult.attachments);
      setHasMore(aroundResult.hasMore);
      setStats(statsResult);
      isInitialLoadRef.current = false;
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [chatId, filters, getCacheKey]);

  // Load more (scroll down - older content for desc sort)
  const loadMore = useCallback(async () => {
    if (!hasMore.after || isLoading || chatId === null || attachments.length === 0) {
      return;
    }

    const lastDate = attachments[attachments.length - 1]?.date;
    if (!lastDate) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    const timer = startTimer('ipc', 'getGalleryAttachments.loadMore');

    try {
      // Get items after the last one (older for desc)
      const result = await window.electronAPI.getGalleryAround({
        chatId,
        target: { type: 'date', date: lastDate - 1 },
        contextCount: DEFAULT_CONTEXT_COUNT,
        types: filters.types === 'all' ? undefined : filters.types,
        direction: filters.direction !== 'all' ? filters.direction : undefined,
      });

      if (abortControllerRef.current?.signal.aborted) return;

      timer.end({ count: result.attachments.length });

      // Append to existing attachments
      setAttachments((prev) => [...prev, ...result.attachments]);
      setHasMore((prev) => ({ ...prev, after: result.hasMore.after }));
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to load more:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasMore.after, isLoading, chatId, attachments, filters]);

  // Load earlier (scroll up - newer content for desc sort)
  const loadEarlier = useCallback(async () => {
    if (!hasMore.before || isLoading || chatId === null || attachments.length === 0) {
      return;
    }

    const firstDate = attachments[0]?.date;
    if (!firstDate) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    const timer = startTimer('ipc', 'getGalleryAttachments.loadEarlier');

    try {
      // Get items before the first one (newer for desc)
      const result = await window.electronAPI.getGalleryAround({
        chatId,
        target: { type: 'date', date: firstDate + 1 },
        contextCount: DEFAULT_CONTEXT_COUNT,
        types: filters.types === 'all' ? undefined : filters.types,
        direction: filters.direction !== 'all' ? filters.direction : undefined,
      });

      if (abortControllerRef.current?.signal.aborted) return;

      timer.end({ count: result.attachments.length });

      // Prepend to existing attachments
      setAttachments((prev) => [...result.attachments, ...prev]);
      // Update BOTH before and after states (fixes the bug)
      setHasMore((prev) => ({
        before: result.hasMore.before,
        after: prev.after, // Keep existing after state
      }));
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to load earlier:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasMore.before, isLoading, chatId, attachments, filters]);

  // Debounced fetch effect when enabled and filters/sort change
  useEffect(() => {
    if (!enabled || chatId === null) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Reset and refetch
      setAttachments([]);
      setHasMore({ before: false, after: false });
      cacheRef.current.clear();
      isInitialLoadRef.current = true;
      executeInitialFetch();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, chatId, filters, sortBy, sortOrder, executeInitialFetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter actions
  const setTypeFilter = useCallback((types: AttachmentType[] | 'all') => {
    setFilters((prev) => ({ ...prev, types }));
  }, []);

  const setDirection = useCallback((direction: 'all' | 'sent' | 'received') => {
    setFilters((prev) => ({ ...prev, direction }));
  }, []);

  const setDateRange = useCallback(
    (
      range:
        | { from: Date | null; to: Date | null; preset: GalleryDatePreset | null }
        | GalleryDatePreset
    ) => {
      if (typeof range === 'string') {
        const { from, to } = getDateRangeFromPreset(range);
        setFilters((prev) => ({
          ...prev,
          dateRange: { from, to, preset: range },
        }));
      } else {
        setFilters((prev) => ({ ...prev, dateRange: range }));
      }
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultGalleryFilters);
  }, []);

  // Sort actions
  const setSortBy = useCallback((sort: GallerySortBy) => {
    setSortByState(sort);
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Refresh - refetch without changing filters
  const refresh = useCallback(() => {
    cacheRef.current.clear();
    setAttachments([]);
    setHasMore({ before: false, after: false });
    isInitialLoadRef.current = true;
    if (enabled && chatId !== null) {
      executeInitialFetch();
    }
  }, [enabled, chatId, executeInitialFetch]);

  // Reset - clear all state (called when gallery closes)
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setAttachments([]);
    setStats(null);
    setHasMore({ before: false, after: false });
    setFilters(defaultGalleryFilters);
    setSortByState('date');
    setSortOrder('desc');
    setError(null);
    setIsLoading(false);
    cacheRef.current.clear();
    isInitialLoadRef.current = true;
  }, []);

  return {
    attachments,
    stats,
    isLoading,
    error,
    hasMore,
    loadMore,
    loadEarlier,
    filters,
    isFiltered,
    setTypeFilter,
    setDirection,
    setDateRange,
    clearFilters,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
    refresh,
    reset,
    // Internal setters for navigation hook
    setAttachments,
    setHasMore,
  };
}
