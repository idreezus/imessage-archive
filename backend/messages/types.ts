// Backend message types - synced with src/types/index.ts
// This is the source of truth for IPC response types.

import { Handle } from "../conversations/types";
import { Attachment } from "../attachments/types";

// Re-export Attachment for convenience
export type { Attachment } from "../attachments/types";

// Message row from database query
export type MessageRow = {
  rowid: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  handleId: number | null;
  date: number;
  isFromMe: number;
  service: string;
  handleIdentifier: string | null;
  handleService: string | null;
  // Additional metadata fields
  dateRead: number | null;
  dateDelivered: number | null;
  dateEdited: number | null;
  dateRetracted: number | null;
  wasDowngraded: number;
  expressiveSendStyleId: string | null;
  isForward: number;
  error: number;
};

// Reaction row from database query
export type ReactionRow = {
  rowid: number;
  guid: string;
  targetMessageGuid: string;
  reactionType: number;
  customEmoji: string | null;
  isFromMe: number;
  date: number;
  reactorIdentifier: string | null;
  reactorService: string | null;
};

// Processed reaction for API response
// Synced with: src/types/index.ts
export type Reaction = {
  rowid: number;
  guid: string;
  type: number; // Reaction type code (2000=love, 2001=like, etc.)
  customEmoji: string | null;
  isFromMe: boolean;
  date: number;
  reactor: {
    identifier: string;
    service: string;
  } | null;
};

// Message type for API responses
export type Message = {
  rowid: number;
  guid: string;
  text: string | null;
  handleId: number | null;
  date: number;
  isFromMe: boolean;
  service: string;
  senderHandle?: Handle;
  reactions: Reaction[];
  attachments: Attachment[];
  // Additional metadata fields
  dateRead: number | null;
  dateDelivered: number | null;
  dateEdited: number | null;
  dateRetracted: number | null;
  wasDowngraded: boolean;
  expressiveSendStyleId: string | null;
  isForward: boolean;
  error: number;
};

// Query options for fetching messages
export type MessagesOptions = {
  chatId: number;
  limit?: number;
  beforeDate?: number;
};

// Re-export navigation types for unified message navigation API
export * from "./navigation-types";
