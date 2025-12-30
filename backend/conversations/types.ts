// Handle (contact) row from database
export type HandleRow = {
  rowid: number;
  id: string;
  service: string;
};

// Handle row with chat association for batch queries
export type HandleWithChatRow = HandleRow & {
  chatId: number;
};

// Conversation row from database query
export type ConversationRow = {
  rowid: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  style: number;
  lastMessageDate: number | null;
  lastMessageText: string | null;
};

// Handle type for API responses
export type Handle = {
  rowid: number;
  id: string;
  service: string;
};

// Conversation type for API responses
export type Conversation = {
  rowid: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  style: number;
  isGroup: boolean;
  lastMessageDate: number;
  lastMessageText: string | null;
  participants: Handle[];
};

// Query options for fetching conversations
export type ConversationsOptions = {
  limit?: number;
  offset?: number;
};
