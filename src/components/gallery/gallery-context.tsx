import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import { LRUCache } from '@/lib/lru-cache';
import { startTimer } from '@/lib/perf';
import type {
  GalleryAttachment,
  GalleryFilters,
  GalleryStats,
  GalleryResponse,
  GalleryQueryOptions,
  GalleryDatePreset,
  GallerySortBy,
  GallerySortOrder,
} from '@/types/gallery';
import { defaultGalleryFilters } from '@/types/gallery';
import type { AttachmentType } from '@/types';

const DEBOUNCE_MS = 150;
const CACHE_SIZE = 10;
const DEFAULT_LIMIT = 100;

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

// Convert UI filters to API options
function filtersToQueryOptions(
  filters: GalleryFilters,
  chatId: number | null,
  sortBy: GallerySortBy,
  sortOrder: GallerySortOrder,
  limit: number,
  offset: number
): GalleryQueryOptions {
  return {
    chatId: chatId ?? undefined,
    types: filters.types === 'all' ? undefined : filters.types,
    direction: filters.direction !== 'all' ? filters.direction : undefined,
    dateFrom: filters.dateRange.from?.getTime(),
    dateTo: filters.dateRange.to?.getTime(),
    sortBy,
    sortOrder,
    limit,
    offset,
  };
}

type GalleryContextValue = {
  // View state
  isGalleryOpen: boolean;
  chatId: number | null;
  chatDisplayName: string | null;

  // Filters
  filters: GalleryFilters;
  setTypeFilter: (types: AttachmentType[] | 'all') => void;
  setDirection: (direction: 'all' | 'sent' | 'received') => void;
  setDateRange: (
    range:
      | { from: Date | null; to: Date | null; preset: GalleryDatePreset | null }
      | GalleryDatePreset
  ) => void;
  setChatFilter: (chatId: number | null) => void;
  clearFilters: () => void;
  isFiltered: boolean;

  // Sort
  sortBy: GallerySortBy;
  sortOrder: GallerySortOrder;
  setSortBy: (sort: GallerySortBy) => void;
  toggleSortOrder: () => void;

  // Data
  attachments: GalleryAttachment[];
  stats: GalleryStats | null;
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;

  // Lightbox
  lightboxOpen: boolean;
  lightboxIndex: number;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;

  // Navigation
  openGallery: (chatId?: number, chatName?: string) => void;
  closeGallery: () => void;
};

const GalleryContext = createContext<GalleryContextValue | null>(null);

export function useGalleryContext() {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGalleryContext must be used within a GalleryProvider');
  }
  return context;
}

export function GalleryProvider({ children }: { children: ReactNode }) {
  // View state
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chatDisplayName, setChatDisplayName] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<GalleryFilters>(defaultGalleryFilters);

  // Sort
  const [sortBy, setSortByState] = useState<GallerySortBy>('date');
  const [sortOrder, setSortOrder] = useState<GallerySortOrder>('desc');

  // Data
  const [attachments, setAttachments] = useState<GalleryAttachment[]>([]);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new LRUCache<string, GalleryResponse>(CACHE_SIZE));
  const currentOffsetRef = useRef(0);

  // Check if any filter is active
  const isFiltered = useMemo(() => {
    return (
      filters.types !== 'all' ||
      filters.direction !== 'all' ||
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.specificChat !== null
    );
  }, [filters]);

  // Execute gallery fetch
  const executeGalleryFetch = useCallback(
    async (
      currentFilters: GalleryFilters,
      currentChatId: number | null,
      currentSortBy: GallerySortBy,
      currentSortOrder: GallerySortOrder,
      offset = 0,
      append = false
    ) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Generate cache key
      const options = filtersToQueryOptions(
        currentFilters,
        currentChatId,
        currentSortBy,
        currentSortOrder,
        DEFAULT_LIMIT,
        offset
      );
      const cacheKey = JSON.stringify(options);

      // Check cache
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        if (append) {
          setAttachments((prev) => [...prev, ...cached.attachments]);
        } else {
          setAttachments(cached.attachments);
        }
        setStats(cached.stats);
        setHasMore(cached.hasMore);
        currentOffsetRef.current = offset + cached.attachments.length;
        return;
      }

      setIsLoading(true);
      setError(null);

      const timer = startTimer('ipc', 'getGalleryAttachments');
      try {
        const response = await window.electronAPI.getGalleryAttachments(options);

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        timer.end({
          chatId: options.chatId ?? null,
          limit: options.limit,
          offset: options.offset,
          attachmentCount: response.attachments.length,
          types: options.types ?? 'all',
        });

        // Cache result
        cacheRef.current.set(cacheKey, response);

        // Update state
        if (append) {
          setAttachments((prev) => [...prev, ...response.attachments]);
        } else {
          setAttachments(response.attachments);
        }
        setStats(response.stats);
        setHasMore(response.hasMore);
        currentOffsetRef.current = offset + response.attachments.length;
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounced fetch effect when gallery is open and filters/sort change
  useEffect(() => {
    if (!isGalleryOpen) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeGalleryFetch(filters, chatId, sortBy, sortOrder, 0, false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isGalleryOpen, filters, chatId, sortBy, sortOrder, executeGalleryFetch]);

  // Actions
  const openGallery = useCallback((newChatId?: number, chatName?: string) => {
    setChatId(newChatId ?? null);
    setChatDisplayName(chatName ?? null);
    setIsGalleryOpen(true);
    setAttachments([]);
    setStats(null);
    setHasMore(false);
    currentOffsetRef.current = 0;
    cacheRef.current.clear();
  }, []);

  const closeGallery = useCallback(() => {
    setIsGalleryOpen(false);
    setChatId(null);
    setChatDisplayName(null);
    setAttachments([]);
    setStats(null);
    setError(null);
    setFilters(defaultGalleryFilters);
    setSortByState('date');
    setSortOrder('desc');
    setLightboxOpen(false);
    currentOffsetRef.current = 0;
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    executeGalleryFetch(
      filters,
      chatId,
      sortBy,
      sortOrder,
      currentOffsetRef.current,
      true
    );
  }, [filters, chatId, sortBy, sortOrder, hasMore, isLoading, executeGalleryFetch]);

  const refresh = useCallback(() => {
    cacheRef.current.clear();
    if (isGalleryOpen) {
      executeGalleryFetch(filters, chatId, sortBy, sortOrder, 0, false);
    }
  }, [isGalleryOpen, filters, chatId, sortBy, sortOrder, executeGalleryFetch]);

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

  const setChatFilter = useCallback((specificChat: number | null) => {
    setFilters((prev) => ({ ...prev, specificChat }));
  }, []);

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

  // Lightbox actions
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const value: GalleryContextValue = {
    isGalleryOpen,
    chatId,
    chatDisplayName,
    filters,
    setTypeFilter,
    setDirection,
    setDateRange,
    setChatFilter,
    clearFilters,
    isFiltered,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
    attachments,
    stats,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    lightboxOpen,
    lightboxIndex,
    openLightbox,
    closeLightbox,
    openGallery,
    closeGallery,
  };

  return (
    <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
  );
}
