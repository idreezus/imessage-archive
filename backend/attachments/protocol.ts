import { protocol, net } from "electron";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";
// @ts-expect-error - heic-convert has no type definitions
import heicConvert from "heic-convert";
import { getAttachmentsBasePath } from "./paths";
import { getCacheKey, readFromCache, writeToCache } from "./thumbnail-cache";
import { isVideoFile } from "./thumbnail-service";
import {
  generateImageThumbnailInWorker,
  generateVideoThumbnailInWorker,
} from "./thumbnail-pool";

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
      // Parse URL to extract path and query parameters
      // URL format: attachment://file/42/02/GUID/file.jpg?size=240
      const url = new URL(request.url);
      let relativePath = decodeURIComponent(url.pathname);

      // Strip leading slash and "file/" prefix
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.slice(1);
      }
      if (relativePath.startsWith("file/")) {
        relativePath = relativePath.slice("file/".length);
      }

      // Parse thumbnail size parameter
      const sizeParam = url.searchParams.get("size");
      const size = sizeParam ? parseInt(sizeParam, 10) : null;

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

      // Handle thumbnail generation if size parameter is provided
      if (size && size > 0 && size <= 1024) {
        try {
          const cacheKey = getCacheKey(relativePath, size);

          // Check cache first
          let thumbnail = await readFromCache(cacheKey);

          if (!thumbnail) {
            // Generate thumbnail in worker thread (non-blocking)
            if (isVideoFile(ext)) {
              // Extract frame from video in worker
              thumbnail = await generateVideoThumbnailInWorker(resolvedPath, size);
            } else {
              // Read image file
              const inputBuffer = await fs.promises.readFile(resolvedPath);
              const isHeic = ext === ".heic" || ext === ".heif";

              // Generate thumbnail in worker (handles HEIC conversion internally)
              thumbnail = await generateImageThumbnailInWorker(inputBuffer, size, isHeic);
            }

            // Cache the result
            await writeToCache(cacheKey, thumbnail);
          }

          return new Response(thumbnail, {
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "public, max-age=31536000",
            },
          });
        } catch (thumbnailError) {
          console.error("Thumbnail generation failed:", thumbnailError);
          // Fall through to serve original file
        }
      }

      // Handle HEIC conversion to JPEG for browser compatibility (full file)
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
