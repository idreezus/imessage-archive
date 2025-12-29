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
import type {
  SearchFilters,
  SearchResultItem,
  SearchResponse,
  DatePreset,
} from '@/types/search';
import {
  defaultSearchFilters,
  filtersToSearchOptions,
  getDateRangeFromPreset,
  countActiveFilters,
} from '@/types/search';

const DEBOUNCE_MS = 150;
const CACHE_SIZE = 20;
const DEFAULT_LIMIT = 50;

type SearchContextValue = {
  // State
  filters: SearchFilters;
  results: SearchResultItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
  isFiltersOpen: boolean;
  isSearchActive: boolean;
  activeFiltersCount: number;

  // Actions
  setQuery: (query: string) => void;
  setDateRange: (
    range:
      | { from: Date | null; to: Date | null; preset: DatePreset | null }
      | DatePreset
  ) => void;
  setSenders: (senders: string[]) => void;
  setChatType: (chatType: 'all' | 'dm' | 'group') => void;
  setDirection: (direction: 'all' | 'sent' | 'received') => void;
  setService: (service: 'all' | 'iMessage' | 'SMS' | 'RCS') => void;
  setHasAttachment: (hasAttachment: boolean | null) => void;
  setSpecificChat: (specificChat: number | null) => void;
  setRegexMode: (regexMode: boolean) => void;
  toggleFilters: () => void;
  setIsFiltersOpen: (open: boolean) => void;
  clearFilters: () => void;
  clearAll: () => void;
  removeFilter: (filterKey: string) => void;
  loadMore: () => void;
  refresh: () => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}

export function SearchProvider({ children }: { children: ReactNode }) {
  // Core state
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Refs for debouncing and caching
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new LRUCache<string, SearchResponse>(CACHE_SIZE));
  const currentOffsetRef = useRef(0);

  // Check if search is active
  const isSearchActive = useMemo(() => {
    return filters.query.trim().length > 0 || countActiveFilters(filters) > 0;
  }, [filters]);

  // Count active filters
  const activeFiltersCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  );

  // Execute search
  const executeSearch = useCallback(
    async (searchFilters: SearchFilters, offset = 0, append = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Generate cache key
      const options = filtersToSearchOptions(
        searchFilters,
        DEFAULT_LIMIT,
        offset
      );
      const cacheKey = JSON.stringify(options);

      // Check cache
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        if (append) {
          setResults((prev) => [...prev, ...cached.results]);
        } else {
          setResults(cached.results);
        }
        setTotal(cached.total);
        setHasMore(cached.hasMore);
        currentOffsetRef.current = offset + cached.results.length;
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await window.electronAPI.search(options);

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        // Cache result
        cacheRef.current.set(cacheKey, response);

        // Update state
        if (append) {
          setResults((prev) => [...prev, ...response.results]);
        } else {
          setResults(response.results);
        }
        setTotal(response.total);
        setHasMore(response.hasMore);
        currentOffsetRef.current = offset + response.results.length;
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

  // Debounced search effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!isSearchActive) {
      setResults([]);
      setTotal(0);
      setHasMore(false);
      currentOffsetRef.current = 0;
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(filters, 0, false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, isSearchActive, executeSearch]);

  // Actions
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    executeSearch(filters, currentOffsetRef.current, true);
  }, [filters, hasMore, isLoading, executeSearch]);

  const setQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, query }));
  }, []);

  const setDateRange = useCallback(
    (
      range:
        | { from: Date | null; to: Date | null; preset: DatePreset | null }
        | DatePreset
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

  const setSenders = useCallback((senders: string[]) => {
    setFilters((prev) => ({ ...prev, senders }));
  }, []);

  const setChatType = useCallback((chatType: 'all' | 'dm' | 'group') => {
    setFilters((prev) => ({ ...prev, chatType }));
  }, []);

  const setDirection = useCallback((direction: 'all' | 'sent' | 'received') => {
    setFilters((prev) => ({ ...prev, direction }));
  }, []);

  const setService = useCallback(
    (service: 'all' | 'iMessage' | 'SMS' | 'RCS') => {
      setFilters((prev) => ({ ...prev, service }));
    },
    []
  );

  const setHasAttachment = useCallback((hasAttachment: boolean | null) => {
    setFilters((prev) => ({ ...prev, hasAttachment }));
  }, []);

  const setSpecificChat = useCallback((specificChat: number | null) => {
    setFilters((prev) => ({ ...prev, specificChat }));
  }, []);

  const setRegexMode = useCallback((regexMode: boolean) => {
    setFilters((prev) => ({ ...prev, regexMode }));
  }, []);

  const toggleFilters = useCallback(() => {
    setIsFiltersOpen((prev) => !prev);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...defaultSearchFilters,
      query: prev.query,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters(defaultSearchFilters);
    setResults([]);
    setTotal(0);
    setHasMore(false);
    setError(null);
    setIsFiltersOpen(false);
    currentOffsetRef.current = 0;
    cacheRef.current.clear();
  }, []);

  const removeFilter = useCallback((filterKey: string) => {
    if (filterKey === 'dateRange') {
      setFilters((prev) => ({
        ...prev,
        dateRange: { from: null, to: null, preset: null },
      }));
    } else if (filterKey.startsWith('sender:')) {
      const sender = filterKey.replace('sender:', '');
      setFilters((prev) => ({
        ...prev,
        senders: prev.senders.filter((s) => s !== sender),
      }));
    } else if (filterKey === 'chatType') {
      setFilters((prev) => ({ ...prev, chatType: 'all' }));
    } else if (filterKey === 'direction') {
      setFilters((prev) => ({ ...prev, direction: 'all' }));
    } else if (filterKey === 'service') {
      setFilters((prev) => ({ ...prev, service: 'all' }));
    } else if (filterKey === 'hasAttachment') {
      setFilters((prev) => ({ ...prev, hasAttachment: null }));
    } else if (filterKey === 'specificChat') {
      setFilters((prev) => ({ ...prev, specificChat: null }));
    } else if (filterKey === 'regexMode') {
      setFilters((prev) => ({ ...prev, regexMode: false }));
    }
  }, []);

  const refresh = useCallback(() => {
    cacheRef.current.clear();
    if (isSearchActive) {
      executeSearch(filters, 0, false);
    }
  }, [filters, isSearchActive, executeSearch]);

  const value: SearchContextValue = {
    filters,
    results,
    total,
    hasMore,
    isLoading,
    error,
    isFiltersOpen,
    isSearchActive,
    activeFiltersCount,
    setQuery,
    setDateRange,
    setSenders,
    setChatType,
    setDirection,
    setService,
    setHasAttachment,
    setSpecificChat,
    setRegexMode,
    toggleFilters,
    setIsFiltersOpen,
    clearFilters,
    clearAll,
    removeFilter,
    loadMore,
    refresh,
  };

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}
