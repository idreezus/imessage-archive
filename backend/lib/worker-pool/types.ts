/**
 * Reusable Worker Pool - Type Definitions
 *
 * A generic worker thread pool for CPU-intensive operations.
 * Keeps the main Electron process responsive by offloading work.
 */

export interface WorkerPoolOptions {
  /** Path to the worker script (must be compiled .js file) */
  workerPath: string;
  /** Maximum number of worker threads (default: CPU cores - 1) */
  maxWorkers?: number;
  /** Task timeout in milliseconds (default: 30000) */
  taskTimeout?: number;
  /** Terminate idle workers after this many ms (default: 60000, 0 = never) */
  idleTimeout?: number;
}

export interface QueuedTask<TData> {
  /** Unique task identifier */
  id: string;
  /** Task data to send to worker */
  data: TData;
  /** Priority (lower = higher priority, default: 0) */
  priority: number;
  /** Promise resolve callback */
  resolve: (result: unknown) => void;
  /** Promise reject callback */
  reject: (error: Error) => void;
  /** Timeout timer reference */
  timeoutId?: NodeJS.Timeout;
  /** When the task was queued */
  queuedAt: number;
}

export interface WorkerInfo {
  /** Worker thread instance */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worker: any; // Worker type from worker_threads
  /** Current task ID being processed (null if idle) */
  currentTaskId: string | null;
  /** When the worker started processing current task */
  taskStartedAt: number | null;
  /** When the worker became idle (for idle timeout) */
  idleSince: number | null;
}

/** Message from main thread to worker */
export interface WorkerTaskMessage<TData> {
  type: "task";
  taskId: string;
  data: TData;
}

/** Message from worker to main thread */
export interface WorkerResultMessage {
  type: "result";
  taskId: string;
  data: unknown;
}

export interface WorkerErrorMessage {
  type: "error";
  taskId: string;
  error: string;
  stack?: string;
}

export interface WorkerReadyMessage {
  type: "ready";
}

export type WorkerMessage =
  | WorkerResultMessage
  | WorkerErrorMessage
  | WorkerReadyMessage;

/** Pool statistics for monitoring */
export interface PoolStats {
  /** Number of active worker threads */
  activeWorkers: number;
  /** Number of idle worker threads */
  idleWorkers: number;
  /** Number of tasks waiting in queue */
  queuedTasks: number;
  /** Total tasks processed since pool creation */
  totalProcessed: number;
  /** Total tasks that failed */
  totalFailed: number;
  /** Total tasks that timed out */
  totalTimedOut: number;
}
