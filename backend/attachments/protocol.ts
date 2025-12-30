import { protocol, net } from "electron";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";
// @ts-expect-error - heic-convert has no type definitions
import heicConvert from "heic-convert";
import { getAttachmentsBasePath } from "./paths";

// MUST be called before app.whenReady() - enables video/audio streaming
// We use "file/" prefix in URLs to prevent numeric path normalization (42 -> 0.0.0.42)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "attachment",
    privileges: {
      standard: true, // Required for proper URL parsing with video
      secure: true, // Treat as secure origin
      supportFetchAPI: true, // Allow fetch API
      stream: true, // CRITICAL: Enable video/audio streaming
      bypassCSP: true, // Bypass CSP for local files
    },
  },
]);

// Register custom protocol for serving attachments.
// Must be called after app.whenReady().
export function registerAttachmentProtocol(): void {
  protocol.handle("attachment", async (request) => {
    try {
      // Extract relative path from URL
      // URL format: attachment://file/42/02/GUID/file.jpg
      // The "file/" prefix prevents browser from normalizing numeric paths as IPs
      let relativePath = decodeURIComponent(
        request.url.slice("attachment://".length)
      );

      // Strip the "file/" prefix that we added to prevent IP normalization
      if (relativePath.startsWith("file/")) {
        relativePath = relativePath.slice("file/".length);
      }

      const basePath = getAttachmentsBasePath();
      const fullPath = path.join(basePath, relativePath);

      // Security: Ensure resolved path is within attachments directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedBase = path.resolve(basePath);

      if (!resolvedPath.startsWith(resolvedBase)) {
        return new Response("Forbidden", { status: 403 });
      }

      // Check file exists
      try {
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      const ext = path.extname(resolvedPath).toLowerCase();

      // Handle HEIC conversion to JPEG for browser compatibility
      if (ext === ".heic" || ext === ".heif") {
        try {
          const inputBuffer = await fs.promises.readFile(resolvedPath);
          const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: "JPEG",
            quality: 0.9,
          });
          return new Response(outputBuffer, {
            headers: { "Content-Type": "image/jpeg" },
          });
        } catch (conversionError) {
          console.error("HEIC conversion failed:", conversionError);
          return new Response("HEIC conversion failed", { status: 500 });
        }
      }

      // Use net.fetch - handles range requests automatically for video/audio
      // Requires: standard: true + stream: true in registerSchemesAsPrivileged
      return net.fetch(pathToFileURL(resolvedPath).toString());
    } catch (error) {
      console.error("Protocol handler error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
}
