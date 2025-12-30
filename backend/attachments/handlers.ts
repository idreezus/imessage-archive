import * as path from "path";
import * as fs from "fs";
import { getAttachmentsBasePath } from "./paths";
import { handleWithTiming } from "../perf";

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
}
