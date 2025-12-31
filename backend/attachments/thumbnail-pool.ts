// Singleton worker pool for thumbnail generation

import * as path from "path";
import * as os from "os";
import { WorkerPool } from "../lib/worker-pool";
import type { ThumbnailTask } from "./thumbnail-worker";

let pool: WorkerPool<ThumbnailTask, Buffer> | null = null;

const POOL_CONFIG = {
  maxWorkers: Math.max(2, os.cpus().length - 2),
  taskTimeout: 30000,
  idleTimeout: 120000,
};

export function getThumbnailPool(): WorkerPool<ThumbnailTask, Buffer> {
  if (!pool) {
    pool = new WorkerPool<ThumbnailTask, Buffer>({
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
): Promise<Buffer> {
  return getThumbnailPool().exec(
    { type: "image", buffer, size, isHeic },
    1 // Higher priority than videos
  );
}

export async function generateVideoThumbnailInWorker(
  filePath: string,
  size: number
): Promise<Buffer> {
  return getThumbnailPool().exec(
    { type: "video", filePath, size },
    10 // Lower priority - videos take longer
  );
}

export async function convertHeicInWorker(
  buffer: Buffer,
  quality: number = 0.9
): Promise<Buffer> {
  return getThumbnailPool().exec(
    { type: "heic-full", buffer, quality },
    5 // Medium priority
  );
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
