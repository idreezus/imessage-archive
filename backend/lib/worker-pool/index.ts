/**
 * Reusable Worker Pool Module
 *
 * A generic worker thread pool for CPU-intensive operations.
 * Use this to offload heavy work from the main Electron process.
 *
 * Example usage:
 * ```typescript
 * import { WorkerPool } from './lib/worker-pool';
 *
 * // Define your task and result types
 * type MyTask = { data: string };
 * type MyResult = { processed: string };
 *
 * // Create pool pointing to compiled worker script
 * const pool = new WorkerPool<MyTask, MyResult>({
 *   workerPath: path.join(__dirname, 'my-worker.js'),
 *   maxWorkers: 4,
 *   taskTimeout: 30000,
 * });
 *
 * // Execute tasks (they queue automatically)
 * const result = await pool.exec({ data: 'hello' });
 *
 * // Shutdown when done
 * await pool.terminate();
 * ```
 */

export { WorkerPool } from "./pool";
export type {
  WorkerPoolOptions,
  QueuedTask,
  WorkerInfo,
  WorkerMessage,
  WorkerResultMessage,
  WorkerErrorMessage,
  WorkerReadyMessage,
  WorkerTaskMessage,
  PoolStats,
} from "./types";
