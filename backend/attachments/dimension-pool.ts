// Singleton worker pool for dimension extraction

import * as path from "path";
import * as os from "os";
import { WorkerPool } from "../lib/worker-pool";
import type { DimensionTask, DimensionResult } from "./dimension-worker";

let pool: WorkerPool<DimensionTask, DimensionResult> | null = null;

const POOL_CONFIG = {
  maxWorkers: Math.max(2, os.cpus().length - 2),
  taskTimeout: 10000, // 10s - dimension extraction is fast
  idleTimeout: 30000, // 30s - short idle since it's a batch job
};

export function getDimensionPool(): WorkerPool<DimensionTask, DimensionResult> {
  if (!pool) {
    pool = new WorkerPool<DimensionTask, DimensionResult>({
      workerPath: path.join(__dirname, "dimension-worker.js"),
      ...POOL_CONFIG,
    });
  }
  return pool;
}

export async function extractDimensionsInWorker(
  task: DimensionTask
): Promise<DimensionResult> {
  // Images are faster, give them higher priority
  const priority = task.type === "image" ? 1 : 5;
  return getDimensionPool().exec(task, priority);
}

export function getDimensionPoolStats() {
  return pool?.getStats() ?? null;
}

export async function shutdownDimensionPool(): Promise<void> {
  if (pool) {
    await pool.terminate();
    pool = null;
  }
}
