// Contact record from handle table
export type Handle = {
  rowid: number;
  id: string; // Phone (+15551234567) or email
  service: string; // "iMessage" | "SMS"
};

// Conversation thread from chat table
export type Conversation = {
  rowid: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  style: number; // 43 = group, 45 = DM
  isGroup: boolean;
  lastMessageDate: number; // JS timestamp (ms)
  lastMessageText: string | null;
  participants: Handle[];
};

// Single message from message table
export type Message = {
  rowid: number;
  guid: string;
  text: string | null;
  handleId: number | null;
  date: number; // JS timestamp (ms)
  isFromMe: boolean;
  service: string;
  senderHandle?: Handle;
};

// IPC response for conversation list query
export type GetConversationsResult = {
  conversations: Conversation[];
  total: number;
};

// IPC response for messages query
export type GetMessagesResult = {
  messages: Message[];
  hasMore: boolean;
};

// Query options for fetching conversations
export type ConversationsQueryOptions = {
  limit?: number;
  offset?: number;
};

// Query options for fetching messages
export type MessagesQueryOptions = {
  chatId: number;
  limit?: number;
  beforeDate?: number;
};
