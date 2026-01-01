import { handleWithTiming } from "../perf";
import {
  getGalleryAttachments,
  getGalleryStats,
  getAttachmentMetadata,
  getGalleryDateIndex,
  getGalleryAround,
} from "./queries";
import type {
  GalleryQueryOptions,
  GalleryStatsOptions,
  GetGalleryAroundOptions,
} from "./types";

// Register gallery-related IPC handlers.
export function registerGalleryHandlers(): void {
  // Get gallery attachments with filtering and pagination
  handleWithTiming(
    "gallery:get-attachments",
    async (_event, options: GalleryQueryOptions) => {
      return getGalleryAttachments(options);
    }
  );

  // Get gallery stats for header display
  handleWithTiming(
    "gallery:get-stats",
    async (_event, options: GalleryStatsOptions) => {
      return getGalleryStats(options);
    }
  );

  // Get full metadata for a single attachment
  handleWithTiming(
    "gallery:get-attachment-metadata",
    async (_event, { rowid }: { rowid: number }) => {
      return getAttachmentMetadata(rowid);
    }
  );

  // Get date index for timeline scrubber navigation
  handleWithTiming(
    "gallery:get-date-index",
    async (_event, { chatId }: { chatId: number }) => {
      return getGalleryDateIndex(chatId);
    }
  );

  // Get gallery attachments centered around a target date for navigation
  handleWithTiming(
    "gallery:get-around",
    async (_event, options: GetGalleryAroundOptions) => {
      return getGalleryAround(options);
    }
  );
}
