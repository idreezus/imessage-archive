import { handleWithTiming } from "../perf";
import {
  getGalleryAttachments,
  getGalleryStats,
  getAttachmentMetadata,
} from "./queries";
import type { GalleryQueryOptions, GalleryStatsOptions } from "./types";

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
}
