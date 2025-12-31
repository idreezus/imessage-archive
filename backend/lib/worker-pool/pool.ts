/**
 * Reusable Worker Pool
 *
 * A generic worker thread pool for CPU-intensive operations.
 * Features:
 * - Configurable concurrency (number of workers)
 * - Priority queue (lower priority value = processed first)
 * - Task timeouts
 * - Idle worker termination
 * - Graceful shutdown
 */

import { Worker } from "worker_threads";
import * as os from "os";
import type {
  WorkerPoolOptions,
  QueuedTask,
  WorkerInfo,
  WorkerMessage,
  WorkerTaskMessage,
  PoolStats,
} from "./types";

export class WorkerPool<TTask, TResult> {
  private readonly workerPath: string;
  private readonly maxWorkers: number;
  private readonly taskTimeout: number;
  private readonly idleTimeout: number;

  private workers: WorkerInfo[] = [];
  private queue: QueuedTask<TTask>[] = [];
  private pendingTasks = new Map<
    string,
    { task: QueuedTask<TTask>; workerInfo: WorkerInfo }
  >();
  private taskIdCounter = 0;
  private isShuttingDown = false;
  private idleCheckInterval: NodeJS.Timeout | null = null;

  // Statistics
  private totalProcessed = 0;
  private totalFailed = 0;
  private totalTimedOut = 0;

  constructor(options: WorkerPoolOptions) {
    this.workerPath = options.workerPath;
    this.maxWorkers = options.maxWorkers ?? Math.max(1, os.cpus().length - 1);
    this.taskTimeout = options.taskTimeout ?? 30000;
    this.idleTimeout = options.idleTimeout ?? 60000;

    // Start idle timeout checker if enabled
    if (this.idleTimeout > 0) {
      this.startIdleChecker();
    }
  }

  /**
   * Execute a task in the worker pool
   * @param data Task data to send to worker
   * @param priority Priority (lower = higher priority, default: 0)
   * @returns Promise resolving to task result
   */
  exec(data: TTask, priority = 0): Promise<TResult> {
    if (this.isShuttingDown) {
      return Promise.reject(new Error("Worker pool is shutting down"));
    }

    return new Promise<TResult>((resolve, reject) => {
      const taskId = `task_${++this.taskIdCounter}`;

      const task: QueuedTask<TTask> = {
        id: taskId,
        data,
        priority,
        resolve: resolve as (result: unknown) => void,
        reject,
        queuedAt: Date.now(),
      };

      // Add to queue in priority order
      this.insertByPriority(task);

      // Try to dispatch immediately
      this.dispatchNext();
    });
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats {
    const activeWorkers = this.workers.filter(
      (w) => w.currentTaskId !== null
    ).length;
    const idleWorkers = this.workers.filter(
      (w) => w.currentTaskId === null
    ).length;

    return {
      activeWorkers,
      idleWorkers,
      queuedTasks: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalTimedOut: this.totalTimedOut,
    };
  }

  /**
   * Gracefully terminate all workers
   * Waits for in-flight tasks to complete (max 5s)
   */
  async terminate(): Promise<void> {
    this.isShuttingDown = true;

    // Clear idle checker
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    // Wait for all in-flight tasks (max 5s)
    if (this.pendingTasks.size > 0) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.pendingTasks.size === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        // Force resolve after 5s
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    }

    // Terminate all workers
    for (const workerInfo of this.workers) {
      try {
        await workerInfo.worker.terminate();
      } catch {
        // Ignore termination errors
      }
    }

    this.workers = [];

    // Reject any remaining pending tasks
    for (const [, { task }] of this.pendingTasks) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      task.reject(new Error("Worker pool terminated"));
    }
    this.pendingTasks.clear();

    // Reject any remaining queued tasks
    for (const task of this.queue) {
      task.reject(new Error("Worker pool terminated"));
    }
    this.queue = [];
  }

  /**
   * Insert task into queue maintaining priority order
   */
  private insertByPriority(task: QueuedTask<TTask>): void {
    // Find insertion point (stable sort - new tasks go after existing same-priority tasks)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority > task.priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, task);
  }

  /**
   * Try to dispatch the next task from queue
   */
  private dispatchNext(): void {
    if (this.queue.length === 0) return;
    if (this.isShuttingDown) return;

    // Find an idle worker
    let workerInfo = this.workers.find((w) => w.currentTaskId === null);

    // Create new worker if none idle and under limit
    if (!workerInfo && this.workers.length < this.maxWorkers) {
      workerInfo = this.createWorker();
    }

    if (!workerInfo) return; // All workers busy

    // Dequeue next task
    const task = this.queue.shift();
    if (!task) return;

    // Assign task to worker
    workerInfo.currentTaskId = task.id;
    workerInfo.taskStartedAt = Date.now();
    workerInfo.idleSince = null;

    // Track pending task
    this.pendingTasks.set(task.id, { task, workerInfo });

    // Set up timeout
    if (this.taskTimeout > 0) {
      task.timeoutId = setTimeout(() => {
        this.handleTaskTimeout(task.id);
      }, this.taskTimeout);
    }

    // Send task to worker
    const message: WorkerTaskMessage<TTask> = {
      type: "task",
      taskId: task.id,
      data: task.data,
    };

    workerInfo.worker.postMessage(message);
  }

  /**
   * Create a new worker thread
   */
  private createWorker(): WorkerInfo {
    const worker = new Worker(this.workerPath);

    const workerInfo: WorkerInfo = {
      worker,
      currentTaskId: null,
      taskStartedAt: null,
      idleSince: Date.now(),
    };

    // Handle messages from worker
    worker.on("message", (message: WorkerMessage) => {
      this.handleWorkerMessage(workerInfo, message);
    });

    // Handle worker errors
    worker.on("error", (error: Error) => {
      this.handleWorkerError(workerInfo, error);
    });

    // Handle worker exit
    worker.on("exit", (code: number) => {
      this.handleWorkerExit(workerInfo, code);
    });

    this.workers.push(workerInfo);
    return workerInfo;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(
    workerInfo: WorkerInfo,
    message: WorkerMessage
  ): void {
    if (message.type === "ready") {
      // Worker initialized, try to dispatch
      this.dispatchNext();
      return;
    }

    const taskId = message.taskId;
    if (!taskId) return;

    // Get pending task
    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      console.warn(`[WorkerPool] Received message for unknown task: ${taskId}`);
      return;
    }

    const { task } = pending;

    // Clear timeout
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
      task.timeoutId = undefined;
    }

    // Remove from pending
    this.pendingTasks.delete(taskId);

    // Mark worker as idle
    workerInfo.currentTaskId = null;
    workerInfo.taskStartedAt = null;
    workerInfo.idleSince = Date.now();

    // Resolve or reject the promise
    if (message.type === "result") {
      this.totalProcessed++;
      task.resolve(message.data);
    } else if (message.type === "error") {
      this.totalFailed++;
      const error = new Error(message.error);
      if (message.stack) {
        error.stack = message.stack;
      }
      task.reject(error);
    }

    // Dispatch next task
    this.dispatchNext();
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerInfo: WorkerInfo, error: Error): void {
    console.error("[WorkerPool] Worker error:", error);

    // Fail any current task
    if (workerInfo.currentTaskId) {
      const pending = this.pendingTasks.get(workerInfo.currentTaskId);
      if (pending) {
        if (pending.task.timeoutId) {
          clearTimeout(pending.task.timeoutId);
        }
        this.pendingTasks.delete(workerInfo.currentTaskId);
        this.totalFailed++;
        pending.task.reject(error);
      }
    }

    // Remove and replace worker
    this.removeWorker(workerInfo);

    // Dispatch queued tasks
    if (!this.isShuttingDown && this.queue.length > 0) {
      this.dispatchNext();
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerInfo: WorkerInfo, code: number): void {
    if (code !== 0 && !this.isShuttingDown) {
      console.warn(`[WorkerPool] Worker exited with code ${code}`);
    }

    // Fail any current task
    if (workerInfo.currentTaskId) {
      const pending = this.pendingTasks.get(workerInfo.currentTaskId);
      if (pending) {
        if (pending.task.timeoutId) {
          clearTimeout(pending.task.timeoutId);
        }
        this.pendingTasks.delete(workerInfo.currentTaskId);
        this.totalFailed++;
        pending.task.reject(new Error(`Worker exited unexpectedly (code ${code})`));
      }
    }

    this.removeWorker(workerInfo);

    // Dispatch queued tasks
    if (!this.isShuttingDown && this.queue.length > 0) {
      this.dispatchNext();
    }
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const pending = this.pendingTasks.get(taskId);
    if (!pending) return;

    const { task, workerInfo } = pending;

    this.totalTimedOut++;
    this.pendingTasks.delete(taskId);

    // Reject the task
    task.reject(new Error(`Task ${taskId} timed out after ${this.taskTimeout}ms`));

    // Terminate the worker (it's stuck)
    this.removeWorker(workerInfo);

    // Create a new worker if we have more tasks
    if (!this.isShuttingDown && this.queue.length > 0) {
      this.dispatchNext();
    }
  }

  /**
   * Remove a worker from the pool
   */
  private removeWorker(workerInfo: WorkerInfo): void {
    const index = this.workers.indexOf(workerInfo);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    try {
      workerInfo.worker.terminate();
    } catch {
      // Ignore termination errors
    }
  }

  /**
   * Start periodic checker to terminate idle workers
   */
  private startIdleChecker(): void {
    this.idleCheckInterval = setInterval(() => {
      if (this.isShuttingDown) {
        if (this.idleCheckInterval) {
          clearInterval(this.idleCheckInterval);
          this.idleCheckInterval = null;
        }
        return;
      }

      const now = Date.now();

      for (const workerInfo of [...this.workers]) {
        if (
          workerInfo.idleSince !== null &&
          now - workerInfo.idleSince > this.idleTimeout &&
          this.workers.length > 1 // Keep at least one worker
        ) {
          this.removeWorker(workerInfo);
        }
      }
    }, 10000); // Check every 10 seconds

    // Don't prevent process exit
    this.idleCheckInterval.unref();
  }
}
