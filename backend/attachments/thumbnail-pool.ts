// Singleton worker pool for thumbnail generation

import * as path from "path";
import * as os from "os";
import { WorkerPool } from "../lib/worker-pool";
import type { ThumbnailTask, ThumbnailResult } from "./thumbnail-worker";

// Pool uses union type since different tasks return different result types
let pool: WorkerPool<ThumbnailTask, Buffer | ThumbnailResult> | null = null;

const POOL_CONFIG = {
  maxWorkers: Math.max(2, os.cpus().length - 2),
  taskTimeout: 30000,
  idleTimeout: 120000,
};

export function getThumbnailPool(): WorkerPool<
  ThumbnailTask,
  Buffer | ThumbnailResult
> {
  if (!pool) {
    pool = new WorkerPool<ThumbnailTask, Buffer | ThumbnailResult>({
      workerPath: path.join(__dirname, "thumbnail-worker.js"),
      ...POOL_CONFIG,
    });
  }
  return pool;
}

export async function generateImageThumbnailInWorker(
  buffer: Buffer,
  size: number,
  isHeic: boolean
): Promise<ThumbnailResult> {
  const result = await getThumbnailPool().exec(
    { type: "image", buffer, size, isHeic },
    1 // Higher priority than videos
  );
  return result as ThumbnailResult;
}

export async function generateVideoThumbnailInWorker(
  filePath: string,
  size: number
): Promise<ThumbnailResult> {
  const result = await getThumbnailPool().exec(
    { type: "video", filePath, size },
    10 // Lower priority - videos take longer
  );
  return result as ThumbnailResult;
}

export async function convertHeicInWorker(
  buffer: Buffer,
  quality: number = 0.9
): Promise<Buffer> {
  const result = await getThumbnailPool().exec(
    { type: "heic-full", buffer, quality },
    5 // Medium priority
  );
  return result as Buffer;
}

export function getThumbnailPoolStats() {
  return pool?.getStats() ?? null;
}

export async function shutdownThumbnailPool(): Promise<void> {
  if (pool) {
    await pool.terminate();
    pool = null;
  }
}
