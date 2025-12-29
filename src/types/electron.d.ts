import type {
  Conversation,
  GetConversationsResult,
  GetMessagesResult,
} from './index';

// Electron API exposed to renderer via preload script
export type ElectronAPI = {
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
};

// Extend Window interface with electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
