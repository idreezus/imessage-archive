import * as path from "path";
import * as fs from "fs";
import { dialog, shell } from "electron";
import { handleWithTiming } from "../perf";
import { getAttachmentsBasePath } from "../attachments/paths";
import {
  getGalleryAttachments,
  getGalleryStats,
  getAttachmentMetadata,
} from "./queries";
import type {
  GalleryQueryOptions,
  GalleryStatsOptions,
  DownloadAttachmentOptions,
  DownloadResult,
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

  // Download attachment to user-selected location
  handleWithTiming(
    "gallery:download-attachment",
    async (_event, options: DownloadAttachmentOptions): Promise<DownloadResult> => {
      const { localPath, suggestedFilename } = options;

      if (!localPath) {
        return { success: false, error: "No file path provided" };
      }

      const basePath = getAttachmentsBasePath();
      const sourcePath = path.join(basePath, localPath);

      // Verify source file exists
      try {
        await fs.promises.access(sourcePath, fs.constants.R_OK);
      } catch {
        return { success: false, error: "Source file not found" };
      }

      // Show save dialog
      const result = await dialog.showSaveDialog({
        defaultPath: suggestedFilename || path.basename(localPath),
        properties: ["createDirectory", "showOverwriteConfirmation"],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // Copy file to destination
      try {
        await fs.promises.copyFile(sourcePath, result.filePath);
        return { success: true, path: result.filePath };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Copy failed",
        };
      }
    }
  );

  // Show attachment in Finder
  handleWithTiming(
    "gallery:show-in-finder",
    async (_event, { localPath }: { localPath: string }) => {
      if (!localPath) {
        return { success: false, error: "No file path provided" };
      }

      const basePath = getAttachmentsBasePath();
      const absolutePath = path.join(basePath, localPath);

      // Verify file exists
      try {
        await fs.promises.access(absolutePath, fs.constants.R_OK);
      } catch {
        return { success: false, error: "File not found" };
      }

      // Show in Finder
      shell.showItemInFolder(absolutePath);
      return { success: true };
    }
  );

  // Share attachment via macOS share sheet
  // Note: Opens the file with the default application, which provides share options
  handleWithTiming(
    "gallery:share-attachment",
    async (_event, { localPath }: { localPath: string }) => {
      if (!localPath) {
        return { success: false, error: "No file path provided" };
      }

      const basePath = getAttachmentsBasePath();
      const absolutePath = path.join(basePath, localPath);

      // Verify file exists
      try {
        await fs.promises.access(absolutePath, fs.constants.R_OK);
      } catch {
        return { success: false, error: "File not found" };
      }

      // Open with default application (provides share options on macOS)
      const errorMessage = await shell.openPath(absolutePath);

      if (errorMessage) {
        return { success: false, error: errorMessage };
      }

      return { success: true };
    }
  );
}
