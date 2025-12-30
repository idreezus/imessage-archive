// Gallery types - synced with backend/gallery/types.ts

import type { AttachmentType } from './index';

// Gallery query options for filtering and pagination
export type GalleryQueryOptions = {
  chatId?: number;
  types?: AttachmentType[];
  direction?: 'all' | 'sent' | 'received';
  dateFrom?: number;
  dateTo?: number;
  sortBy?: 'date' | 'size' | 'type';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

// Gallery attachment with message context
export type GalleryAttachment = {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  uti: string | null;
  transferName: string | null;
  totalBytes: number;
  localPath: string | null;
  type: AttachmentType;
  date: number;
  isFromMe: boolean;
  chatId: number;
  chatDisplayName: string | null;
  monthKey: string;
};

// Gallery stats for header display
export type GalleryStats = {
  photos: number;
  videos: number;
  audio: number;
  files: number;
  total: number;
};

// Gallery query response
export type GalleryResponse = {
  attachments: GalleryAttachment[];
  total: number;
  hasMore: boolean;
  stats: GalleryStats;
};

// Stats query options (subset of GalleryQueryOptions)
export type GalleryStatsOptions = {
  chatId?: number;
  types?: AttachmentType[];
  direction?: 'all' | 'sent' | 'received';
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
  createdDate: number | null;
  messageDate: number;
  isFromMe: boolean;
  senderHandle: string | null;
  chatDisplayName: string | null;
  absolutePath: string | null;
};

// Gallery filter state
export type GalleryFilters = {
  types: AttachmentType[] | 'all';
  direction: 'all' | 'sent' | 'received';
  dateRange: {
    from: Date | null;
    to: Date | null;
    preset: GalleryDatePreset | null;
  };
  specificChat: number | null;
};

// Date presets for gallery filtering
export type GalleryDatePreset = '7days' | '30days' | 'year' | 'custom';

// Default gallery filters
export const defaultGalleryFilters: GalleryFilters = {
  types: 'all',
  direction: 'all',
  dateRange: {
    from: null,
    to: null,
    preset: null,
  },
  specificChat: null,
};

// Gallery sort options
export type GallerySortBy = 'date' | 'size' | 'type';
export type GallerySortOrder = 'asc' | 'desc';

// Grid item type for virtualized list (includes month headers)
export type GalleryGridItem =
  | { type: 'header'; monthKey: string; label: string }
  | { type: 'attachment'; data: GalleryAttachment };

// Month group for chat-scoped view
export type MonthGroup = {
  monthKey: string;
  label: string;
  attachments: GalleryAttachment[];
  startIndex: number;
};
