import { Handle } from "../conversations/types";
import { Attachment } from "../attachments/types";

// Re-export Attachment for convenience
export type { Attachment } from "../attachments/types";

// Message row from database query
export type MessageRow = {
  rowid: number;
  guid: string;
  text: string | null;
  handleId: number | null;
  date: number;
  isFromMe: number;
  service: string;
  handleIdentifier: string | null;
  handleService: string | null;
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
export type Reaction = {
  rowid: number;
  guid: string;
  type: number;
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
};

// Query options for fetching messages
export type MessagesOptions = {
  chatId: number;
  limit?: number;
  beforeDate?: number;
};
