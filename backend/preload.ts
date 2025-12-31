import { contextBridge, ipcRenderer } from "electron";

// Type definitions for IPC API exposed to renderer
type ConversationsOptions = {
  limit?: number;
  offset?: number;
};

type MessagesOptions = {
  chatId: number;
  limit?: number;
  beforeDate?: number;
};

type SearchOptions = {
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

type AttachmentType =
  | "image"
  | "video"
  | "audio"
  | "voice-memo"
  | "sticker"
  | "document"
  | "other";

type GalleryQueryOptions = {
  chatId?: number;
  types?: AttachmentType[];
  direction?: "all" | "sent" | "received";
  dateFrom?: number;
  dateTo?: number;
  sortBy?: "date" | "size" | "type";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

type GalleryStatsOptions = {
  chatId?: number;
  types?: AttachmentType[];
  direction?: "all" | "sent" | "received";
  dateFrom?: number;
  dateTo?: number;
};

type DownloadAttachmentOptions = {
  localPath: string;
  suggestedFilename: string;
};

// Electron API bridge exposed to renderer via window.electronAPI.
const electronAPI = {
  // Fetch paginated list of conversations
  getConversations: (options?: ConversationsOptions) =>
    ipcRenderer.invoke("db:get-conversations", options),

  // Fetch messages for a conversation with cursor pagination
  getMessages: (options: MessagesOptions) =>
    ipcRenderer.invoke("db:get-messages", options),

  // Fetch single conversation by ID
  getConversationById: (chatId: number) =>
    ipcRenderer.invoke("db:get-conversation-by-id", { chatId }),

  // Check database connection status
  getDatabaseStatus: () => ipcRenderer.invoke("db:get-status"),

  // Theme controls
  getTheme: () => ipcRenderer.invoke("theme:get") as Promise<"light" | "dark" | "system">,
  setTheme: (theme: "light" | "dark" | "system") =>
    ipcRenderer.invoke("theme:set", theme) as Promise<boolean>,
  shouldUseDarkColors: () => ipcRenderer.invoke("theme:shouldUseDarkColors") as Promise<boolean>,

  // Search API
  search: (options: SearchOptions) => ipcRenderer.invoke("search:query", options),
  getSearchStatus: () => ipcRenderer.invoke("search:status"),
  rebuildSearchIndex: () => ipcRenderer.invoke("search:rebuild"),
  getHandles: () => ipcRenderer.invoke("search:get-handles"),
  getChatsForFilter: () => ipcRenderer.invoke("search:get-chats"),

  // Get messages around a specific date (for scroll-to navigation)
  getMessagesAroundDate: (chatId: number, targetDate: number, contextCount?: number) =>
    ipcRenderer.invoke("db:get-messages-around-date", { chatId, targetDate, contextCount }),

  // Get attachment file URL from relative path
  getAttachmentFileUrl: (relativePath: string) =>
    ipcRenderer.invoke("attachment:get-file-url", { relativePath }) as Promise<string | null>,

  // Gallery API
  getGalleryAttachments: (options: GalleryQueryOptions) =>
    ipcRenderer.invoke("gallery:get-attachments", options),

  getGalleryStats: (options: GalleryStatsOptions) =>
    ipcRenderer.invoke("gallery:get-stats", options),

  getAttachmentMetadata: (rowid: number) =>
    ipcRenderer.invoke("gallery:get-attachment-metadata", { rowid }),

  // Timeline scrubber date index API
  getDateIndex: (chatId: number) =>
    ipcRenderer.invoke("db:get-date-index", { chatId }),

  getGalleryDateIndex: (chatId: number) =>
    ipcRenderer.invoke("gallery:get-date-index", { chatId }),

  downloadAttachment: (options: DownloadAttachmentOptions) =>
    ipcRenderer.invoke("attachments:download", options),

  showInFinder: (localPath: string) =>
    ipcRenderer.invoke("attachments:show-in-finder", { localPath }),

  shareAttachment: (localPath: string) =>
    ipcRenderer.invoke("attachments:share", { localPath }),

  // Get cached dimensions for multiple attachments (used to prevent layout shift)
  getAttachmentDimensions: (localPaths: string[]) =>
    ipcRenderer.invoke("attachment:get-dimensions-batch", { localPaths }) as Promise<
      Record<string, { width: number; height: number }>
    >,

  // Indexing API
  getUnindexedCount: () =>
    ipcRenderer.invoke("indexing:get-unindexed-count") as Promise<number>,

  startIndexing: () => ipcRenderer.invoke("indexing:start"),

  isIndexingInProgress: () =>
    ipcRenderer.invoke("indexing:is-in-progress") as Promise<boolean>,

  getIndexingProgress: () => ipcRenderer.invoke("indexing:get-progress"),

  // Subscribe to indexing progress updates (push from main process)
  onIndexingProgress: (
    callback: (progress: {
      phase: "scanning" | "indexing" | "complete" | "error";
      processed: number;
      total: number;
      currentFile?: string;
      error?: string;
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: {
        phase: "scanning" | "indexing" | "complete" | "error";
        processed: number;
        total: number;
        currentFile?: string;
        error?: string;
      }
    ) => {
      callback(progress);
    };
    ipcRenderer.on("indexing:progress", handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener("indexing:progress", handler);
    };
  },
};

// Expose API to renderer process securely
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
