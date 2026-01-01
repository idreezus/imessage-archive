import type {
  Conversation,
  GetConversationsResult,
  GetMessagesResult,
  Handle,
  Message,
} from './index';
import type {
  SearchOptions,
  SearchResponse,
  SearchIndexStatus,
  IndexBuildResult,
  ChatFilterOption,
} from './search';
import type {
  GalleryQueryOptions,
  GalleryStatsOptions,
  GalleryResponse,
  GalleryStats,
  DownloadAttachmentOptions,
  DownloadResult,
  AttachmentMetadata,
} from './gallery';
import type { DateIndexResponse } from './timeline';

// Indexing progress type for media dimension extraction
export type IndexingProgress = {
  phase: 'scanning' | 'indexing' | 'complete' | 'error';
  processed: number;
  total: number;
  currentFile?: string;
  error?: string;
};

// Electron API exposed to renderer via preload script
export type ElectronAPI = {
  // Conversation API
  getConversations: (options?: {
    limit?: number;
    offset?: number;
  }) => Promise<GetConversationsResult>;

  getMessages: (options: {
    chatId: number;
    limit?: number;
    beforeDate?: number;
  }) => Promise<GetMessagesResult>;

  getConversationById: (chatId: number) => Promise<Conversation | null>;

  getDatabaseStatus: () => Promise<{
    connected: boolean;
    path: string;
  }>;

  // Unified navigation API - supports date, rowId, and monthKey targets
  getMessagesAround: (options: {
    chatId: number;
    target:
      | { type: "date"; date: number }
      | { type: "rowId"; rowId: number; fallbackDate?: number }
      | { type: "monthKey"; monthKey: string };
    contextCount?: number;
  }) => Promise<{
    messages: Message[];
    targetIndex: number;
    targetRowId: number | null;
    found: boolean;
    hasMore: { before: boolean; after: boolean };
  }>;

  // Deprecated: Messages around date (for scroll-to navigation)
  // Use getMessagesAround with type: "date" instead
  getMessagesAroundDate: (
    chatId: number,
    targetDate: number,
    contextCount?: number
  ) => Promise<{
    messages: Message[];
    targetIndex: number;
  }>;

  // Search API
  search: (options: SearchOptions) => Promise<SearchResponse>;
  getSearchStatus: () => Promise<SearchIndexStatus>;
  rebuildSearchIndex: () => Promise<IndexBuildResult>;
  getHandles: () => Promise<Handle[]>;
  getChatsForFilter: () => Promise<ChatFilterOption[]>;

  // Attachment API
  getAttachmentFileUrl: (relativePath: string) => Promise<string | null>;
  getAttachmentDimensions: (
    localPaths: string[]
  ) => Promise<Record<string, { width: number; height: number }>>;

  // Gallery API
  getGalleryAttachments: (options: GalleryQueryOptions) => Promise<GalleryResponse>;
  getGalleryStats: (options: GalleryStatsOptions) => Promise<GalleryStats>;
  getAttachmentMetadata: (rowid: number) => Promise<AttachmentMetadata | null>;
  downloadAttachment: (options: DownloadAttachmentOptions) => Promise<DownloadResult>;
  showInFinder: (localPath: string) => Promise<{ success: boolean; error?: string }>;
  shareAttachment: (localPath: string) => Promise<{ success: boolean; error?: string }>;

  // Timeline scrubber date index API
  getDateIndex: (chatId: number) => Promise<DateIndexResponse>;
  getGalleryDateIndex: (chatId: number) => Promise<DateIndexResponse>;

  // Indexing API
  getUnindexedCount: () => Promise<number>;
  startIndexing: () => Promise<IndexingProgress>;
  isIndexingInProgress: () => Promise<boolean>;
  getIndexingProgress: () => Promise<IndexingProgress>;
  onIndexingProgress: (callback: (progress: IndexingProgress) => void) => () => void;
};

// Extend Window interface with electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
