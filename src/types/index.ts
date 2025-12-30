// Shared types - keep in sync with backend/*/types.ts
// Backend is the source of truth for IPC response types.

// Contact record from handle table
export type Handle = {
  rowid: number;
  id: string; // Phone (+15551234567) or email
  service: string; // "iMessage" | "SMS"
};

// Reaction (Tapback) type codes from iMessage
export const REACTION_TYPES = {
  LOVE: 2000,
  LIKE: 2001,
  DISLIKE: 2002,
  LAUGH: 2003,
  EMPHASIZE: 2004,
  QUESTION: 2005,
} as const;

export type ReactionTypeCode =
  (typeof REACTION_TYPES)[keyof typeof REACTION_TYPES];

// Map reaction type code to emoji character
export const REACTION_EMOJI: Record<ReactionTypeCode, string> = {
  [REACTION_TYPES.LOVE]: '❤️',
  [REACTION_TYPES.LIKE]: '👍',
  [REACTION_TYPES.DISLIKE]: '👎',
  [REACTION_TYPES.LAUGH]: '😂',
  [REACTION_TYPES.EMPHASIZE]: '‼️',
  [REACTION_TYPES.QUESTION]: '❓',
};

// Map reaction type code to display name
export const REACTION_NAMES: Record<ReactionTypeCode, string> = {
  [REACTION_TYPES.LOVE]: 'Loved',
  [REACTION_TYPES.LIKE]: 'Liked',
  [REACTION_TYPES.DISLIKE]: 'Disliked',
  [REACTION_TYPES.LAUGH]: 'Laughed at',
  [REACTION_TYPES.EMPHASIZE]: 'Emphasized',
  [REACTION_TYPES.QUESTION]: 'Questioned',
};

// Individual reaction from a user
// Synced with: backend/messages/types.ts
export type Reaction = {
  rowid: number;
  guid: string;
  type: number; // ReactionTypeCode values (2000-2005), use REACTION_EMOJI for display
  customEmoji: string | null;
  isFromMe: boolean;
  date: number;
  reactor: {
    identifier: string;
    service: string;
  } | null;
};

// Aggregated reaction for display (grouped by type)
export type AggregatedReaction = {
  type: ReactionTypeCode;
  emoji: string;
  count: number;
  reactors: Array<{
    identifier: string;
    isFromMe: boolean;
  }>;
};

// Attachment type classification
export type AttachmentType =
  | 'image'
  | 'video'
  | 'audio'
  | 'voice-memo'
  | 'sticker'
  | 'document'
  | 'other';

// Attachment from message_attachment_join
export type Attachment = {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  isSticker: boolean;
  isAudioMessage: boolean;
  localPath: string | null;
  type: AttachmentType;
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
  reactions: Reaction[];
  attachments: Attachment[];
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
