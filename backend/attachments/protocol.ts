// Custom protocol for serving attachments with thumbnail generation

import { protocol, net } from "electron";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";
import { getAttachmentsBasePath } from "./paths";
import { getCacheKey, readFromCache, writeToCache } from "./thumbnail-cache";
import { isVideoFile } from "./thumbnail-service";
import {
  generateImageThumbnailInWorker,
  generateVideoThumbnailInWorker,
  convertHeicInWorker,
} from "./thumbnail-pool";

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "attachment",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

// Register custom protocol for serving attachments
export function registerAttachmentProtocol(): void {
  protocol.handle("attachment", async (request) => {
    try {
      const url = new URL(request.url);
      let relativePath = decodeURIComponent(url.pathname);

      // Strip leading slash and "file/" prefix
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.slice(1);
      }
      if (relativePath.startsWith("file/")) {
        relativePath = relativePath.slice("file/".length);
      }

      const sizeParam = url.searchParams.get("size");
      const size = sizeParam ? parseInt(sizeParam, 10) : null;

      const basePath = getAttachmentsBasePath();
      const fullPath = path.join(basePath, relativePath);

      // Prevent path traversal
      const resolvedPath = path.resolve(fullPath);
      const resolvedBase = path.resolve(basePath);
      if (!resolvedPath.startsWith(resolvedBase)) {
        return new Response("Forbidden", { status: 403 });
      }

      try {
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      const ext = path.extname(resolvedPath).toLowerCase();

      // Thumbnail generation
      if (size && size > 0 && size <= 1024) {
        try {
          const cacheKey = getCacheKey(relativePath, size);
          let thumbnail = await readFromCache(cacheKey);

          if (!thumbnail) {
            if (isVideoFile(ext)) {
              thumbnail = await generateVideoThumbnailInWorker(resolvedPath, size);
            } else {
              const inputBuffer = await fs.promises.readFile(resolvedPath);
              const isHeic = ext === ".heic" || ext === ".heif";
              thumbnail = await generateImageThumbnailInWorker(inputBuffer, size, isHeic);
            }
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
        }
      }

      // HEIC conversion for browser compatibility
      if (ext === ".heic" || ext === ".heif") {
        try {
          const inputBuffer = await fs.promises.readFile(resolvedPath);
          const outputBuffer = await convertHeicInWorker(inputBuffer, 0.9);
          return new Response(outputBuffer, {
            headers: { "Content-Type": "image/jpeg" },
          });
        } catch (conversionError) {
          console.error("HEIC conversion failed:", conversionError);
          return new Response("HEIC conversion failed", { status: 500 });
        }
      }

      // Serve original file with streaming support
      return net.fetch(pathToFileURL(resolvedPath).toString());
    } catch (error) {
      console.error("Protocol handler error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
}
