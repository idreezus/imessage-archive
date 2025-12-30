// Search filter options
export type SearchFilters = {
  query: string;
  dateFrom?: number; // JS timestamp
  dateTo?: number; // JS timestamp
  senders?: string[]; // Handle IDs (will be normalized)
  chatType?: "all" | "dm" | "group";
  direction?: "all" | "sent" | "received";
  service?: "all" | "iMessage" | "SMS" | "RCS";
  hasAttachment?: boolean;
  specificChat?: number; // Chat ROWID
  regexMode?: boolean;
};

// Search query options
export type SearchOptions = SearchFilters & {
  limit?: number;
  offset?: number;
};

// Individual search result
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

// Search response
export type SearchResponse = {
  results: SearchResultItem[];
  total: number;
  hasMore: boolean;
  queryTime: number;
};

// Index status
export type IndexStatus = {
  indexed: boolean;
  messageCount: number;
  lastSyncTime: number | null;
  chatDbPath: string | null;
};

// Raw row from FTS search
export type SearchRow = {
  message_rowid: number;
  chat_rowid: number;
  text: string | null;
  sender_handle: string | null;
  date_ts: number;
  is_from_me: number;
  service: string;
  has_attachment: number;
  chat_style: number;
  chat_display_name: string | null;
};

// Raw row from chat.db for indexing
export type IndexMessageRow = {
  messageRowid: number;
  chatRowid: number;
  text: string | null;
  senderHandle: string | null;
  date: number;
  isFromMe: number;
  service: string;
  hasAttachment: number;
  chatStyle: number;
  chatDisplayName: string | null;
};

// Build result
export type IndexBuildResult = {
  success: boolean;
  messageCount: number;
  duration: number;
  error?: string;
};
