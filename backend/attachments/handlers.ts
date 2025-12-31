import * as path from "path";
import * as fs from "fs";
import { dialog, shell } from "electron";
import { getAttachmentsBasePath } from "./paths";
import { handleWithTiming } from "../perf";
import { getBatch } from "./dimensions-cache";

type DownloadAttachmentOptions = {
  localPath: string;
  suggestedFilename: string;
};

type DownloadResult = {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
};

// Register attachment-related IPC handlers.
export function registerAttachmentHandlers(): void {
  // Get attachment file URL from relative path
  // Uses custom attachment:// protocol to bypass same-origin restrictions in dev mode
  handleWithTiming(
    "attachment:get-file-url",
    async (_event, { relativePath }: { relativePath: string }) => {
      if (!relativePath) return null;

      const basePath = getAttachmentsBasePath();
      const fullPath = path.join(basePath, relativePath);

      try {
        // Check if file exists
        await fs.promises.access(fullPath, fs.constants.R_OK);
        // Return attachment:// URL for renderer
        // Use "file/" prefix to prevent browser from normalizing numeric paths as IP addresses
        // (e.g., "42/..." would become "0.0.0.42/..." without a prefix)
        return `attachment://file/${relativePath}`;
      } catch {
        // File doesn't exist or isn't readable
        return null;
      }
    }
  );

  // Download attachment to user-selected location
  handleWithTiming(
    "attachments:download",
    async (
      _event,
      options: DownloadAttachmentOptions
    ): Promise<DownloadResult> => {
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
    "attachments:show-in-finder",
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
    "attachments:share",
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

  // Get cached dimensions for attachments (used to prevent layout shift)
  handleWithTiming(
    "attachment:get-dimensions-batch",
    async (_event, { localPaths }: { localPaths: string[] }) => {
      return getBatch(localPaths);
    }
  );
}
