// Search filter state for UI
export type SearchFilters = {
  query: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
    preset: DatePreset | null;
  };
  senders: string[];
  chatType: "all" | "dm" | "group";
  direction: "all" | "sent" | "received";
  service: "all" | "iMessage" | "SMS" | "RCS";
  hasAttachment: boolean | null;
  specificChat: number | null;
  regexMode: boolean;
};

// Date preset options
export type DatePreset = "today" | "7days" | "30days" | "year" | "custom";

// Search options for API calls
export type SearchOptions = {
  query: string;
  dateFrom?: number;
  dateTo?: number;
  senders?: string[];
  chatType?: "all" | "dm" | "group";
  direction?: "all" | "sent" | "received";
  service?: "all" | "iMessage" | "SMS" | "RCS";
  hasAttachment?: boolean;
  specificChat?: number;
  regexMode?: boolean;
  limit?: number;
  offset?: number;
};

// Individual search result from API
export type SearchResultItem = {
  messageRowid: number;
  chatRowid: number;
  text: string | null;
  snippet: string;
  senderHandle: string | null;
  date: number;
  isFromMe: boolean;
  service: string;
  hasAttachment: boolean;
  chatDisplayName: string | null;
  chatIsGroup: boolean;
};

// Search response from API
export type SearchResponse = {
  results: SearchResultItem[];
  total: number;
  hasMore: boolean;
  queryTime: number;
};

// Search index status
export type SearchIndexStatus = {
  indexed: boolean;
  messageCount: number;
  lastSyncTime: number | null;
  chatDbPath: string | null;
};

// Index build result
export type IndexBuildResult = {
  success: boolean;
  messageCount: number;
  duration: number;
  error?: string;
};

// Search state for useSearch hook
export type SearchState = {
  isSearching: boolean;
  isFiltersOpen: boolean;
  filters: SearchFilters;
  results: SearchResultItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
};

// Chat option for filter dropdown
export type ChatFilterOption = {
  rowid: number;
  displayName: string | null;
  chatIdentifier: string;
  isGroup: boolean;
};

// Initial/default search filters
export const defaultSearchFilters: SearchFilters = {
  query: "",
  dateRange: {
    from: null,
    to: null,
    preset: null,
  },
  senders: [],
  chatType: "all",
  direction: "all",
  service: "all",
  hasAttachment: null,
  specificChat: null,
  regexMode: false,
};

// Helper to convert UI filters to API options
export function filtersToSearchOptions(
  filters: SearchFilters,
  limit = 50,
  offset = 0
): SearchOptions {
  return {
    query: filters.query,
    dateFrom: filters.dateRange.from?.getTime(),
    dateTo: filters.dateRange.to?.getTime(),
    senders: filters.senders.length > 0 ? filters.senders : undefined,
    chatType: filters.chatType !== "all" ? filters.chatType : undefined,
    direction: filters.direction !== "all" ? filters.direction : undefined,
    service: filters.service !== "all" ? filters.service : undefined,
    hasAttachment: filters.hasAttachment ?? undefined,
    specificChat: filters.specificChat ?? undefined,
    regexMode: filters.regexMode || undefined,
    limit,
    offset,
  };
}

// Helper to get date range from preset
export function getDateRangeFromPreset(preset: DatePreset): {
  from: Date | null;
  to: Date | null;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (preset) {
    case "today":
      return { from: today, to: endOfToday };
    case "7days": {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { from, to: endOfToday };
    }
    case "30days": {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return { from, to: endOfToday };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to: endOfToday };
    }
    case "custom":
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

// Helper to count active filters
export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.dateRange.from || filters.dateRange.to) count++;
  if (filters.senders.length > 0) count++;
  if (filters.chatType !== "all") count++;
  if (filters.direction !== "all") count++;
  if (filters.service !== "all") count++;
  if (filters.hasAttachment !== null) count++;
  if (filters.specificChat !== null) count++;
  if (filters.regexMode) count++;
  return count;
}
