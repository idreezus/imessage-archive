// Gallery types for attachment browsing
// Synced with: src/types/gallery.ts

import type { AttachmentType } from "../attachments/types";

// Gallery query options for filtering and pagination
export type GalleryQueryOptions = {
  chatId?: number; // If provided, chat-scoped; otherwise global
  types?: AttachmentType[]; // Filter by attachment type
  direction?: "all" | "sent" | "received";
  dateFrom?: number; // JS timestamp
  dateTo?: number; // JS timestamp
  sortBy?: "date" | "size" | "type";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

// Gallery attachment with message context
export type GalleryAttachment = {
  rowid: number;
  messageId: number; // Message ROWID for navigation
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  localPath: string | null;
  type: AttachmentType;
  date: number; // JS timestamp from message
  isFromMe: boolean;
  chatId: number;
  chatDisplayName: string | null;
};

// Gallery query response
// Note: stats may be null when fetched separately for parallel loading
export type GalleryResponse = {
  attachments: GalleryAttachment[];
  total: number;
  hasMore: boolean;
  stats: GalleryStats | null;
};

// Gallery stats for header display
export type GalleryStats = {
  photos: number;
  videos: number;
  audio: number;
  files: number;
  total: number;
};

// Stats query options (subset of GalleryQueryOptions)
export type GalleryStatsOptions = {
  chatId?: number;
  types?: AttachmentType[];
  direction?: "all" | "sent" | "received";
  dateFrom?: number;
  dateTo?: number;
};

// Download attachment options
export type DownloadAttachmentOptions = {
  localPath: string;
  suggestedFilename: string;
};

// Download result
export type DownloadResult = {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
};

// Attachment metadata for info panel
export type AttachmentMetadata = {
  rowid: number;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  totalBytes: number;
  transferName: string | null;
  createdDate: number | null; // When attachment was created
  messageDate: number; // When message was sent
  isFromMe: boolean;
  senderHandle: string | null;
  chatDisplayName: string | null;
  absolutePath: string | null; // Full filesystem path
};

// Gallery attachment row from database query (internal)
export type GalleryAttachmentRow = {
  rowid: number;
  messageId: number; // Message ROWID from join table
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  isSticker: number;
  isAudioMessage: number;
  messageDate: number; // Apple timestamp
  isFromMe: number;
  chatId: number;
  chatDisplayName: string | null;
  createdDate: number | null; // Apple timestamp
  senderHandle: string | null;
};

// Options for getGalleryAround navigation query
export type GetGalleryAroundOptions = {
  chatId: number;
  target: { type: "date"; date: number };
  contextCount?: number;
  types?: AttachmentType[];
  direction?: "all" | "sent" | "received";
};

// Result from getGalleryAround query
export type GetGalleryAroundResult = {
  attachments: GalleryAttachment[];
  targetIndex: number;
  found: boolean;
  hasMore: { before: boolean; after: boolean };
};
