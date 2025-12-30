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

  // Messages around date (for scroll-to navigation)
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
};

// Extend Window interface with electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
