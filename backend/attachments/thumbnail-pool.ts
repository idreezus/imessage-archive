/**
 * Thumbnail Pool
 *
 * Singleton worker pool for thumbnail generation.
 * Manages concurrent thumbnail processing without blocking the main thread.
 */

import * as path from "path";
import * as os from "os";
import { WorkerPool } from "../lib/worker-pool";
import type { ThumbnailTask } from "./thumbnail-worker";

// Singleton pool instance
let pool: WorkerPool<ThumbnailTask, Buffer> | null = null;

// Pool configuration
const POOL_CONFIG = {
  // Leave 2 cores for main process + renderer
  // Minimum 2 workers for parallelism
  maxWorkers: Math.max(2, os.cpus().length - 2),

  // 30 second timeout for thumbnail generation
  taskTimeout: 30000,

  // Terminate idle workers after 2 minutes
  idleTimeout: 120000,
};

/**
 * Get or create the thumbnail worker pool
 */
export function getThumbnailPool(): WorkerPool<ThumbnailTask, Buffer> {
  if (!pool) {
    pool = new WorkerPool<ThumbnailTask, Buffer>({
      // Point to compiled worker script
      workerPath: path.join(__dirname, "thumbnail-worker.js"),
      ...POOL_CONFIG,
    });
  }
  return pool;
}

/**
 * Generate an image thumbnail using the worker pool
 *
 * @param buffer Raw image data
 * @param size Target thumbnail size (square)
 * @param isHeic Whether the image is HEIC/HEIF format
 * @returns WebP thumbnail buffer
 */
export async function generateImageThumbnailInWorker(
  buffer: Buffer,
  size: number,
  isHeic: boolean
): Promise<Buffer> {
  return getThumbnailPool().exec(
    {
      type: "image",
      buffer,
      size,
      isHeic,
    },
    // Priority 1 (higher priority than videos)
    1
  );
}

/**
 * Generate a video thumbnail using the worker pool
 *
 * @param filePath Absolute path to video file
 * @param size Target thumbnail size (square)
 * @returns WebP thumbnail buffer
 */
export async function generateVideoThumbnailInWorker(
  filePath: string,
  size: number
): Promise<Buffer> {
  return getThumbnailPool().exec(
    {
      type: "video",
      filePath,
      size,
    },
    // Priority 10 (lower priority - videos take longer)
    10
  );
}

/**
 * Get current pool statistics for debugging
 */
export function getThumbnailPoolStats() {
  return pool?.getStats() ?? null;
}

/**
 * Shutdown the thumbnail pool
 * Call this on app quit for clean shutdown
 */
export async function shutdownThumbnailPool(): Promise<void> {
  if (pool) {
    await pool.terminate();
    pool = null;
  }
}
