// Generic worker thread pool for CPU-intensive operations

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

  private totalProcessed = 0;
  private totalFailed = 0;
  private totalTimedOut = 0;

  constructor(options: WorkerPoolOptions) {
    this.workerPath = options.workerPath;
    this.maxWorkers = options.maxWorkers ?? Math.max(1, os.cpus().length - 1);
    this.taskTimeout = options.taskTimeout ?? 30000;
    this.idleTimeout = options.idleTimeout ?? 60000;

    if (this.idleTimeout > 0) {
      this.startIdleChecker();
    }
  }

  // Execute a task in the worker pool (lower priority value = higher priority)
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

      this.insertByPriority(task);
      this.dispatchNext();
    });
  }

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

  // Gracefully terminate all workers, waiting up to 5s for in-flight tasks
  async terminate(): Promise<void> {
    this.isShuttingDown = true;

    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    if (this.pendingTasks.size > 0) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.pendingTasks.size === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    }

    for (const workerInfo of this.workers) {
      try {
        await workerInfo.worker.terminate();
      } catch {
        // Ignore termination errors
      }
    }

    this.workers = [];

    for (const [, { task }] of this.pendingTasks) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      task.reject(new Error("Worker pool terminated"));
    }
    this.pendingTasks.clear();

    for (const task of this.queue) {
      task.reject(new Error("Worker pool terminated"));
    }
    this.queue = [];
  }

  // Insert task maintaining priority order (stable sort)
  private insertByPriority(task: QueuedTask<TTask>): void {
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority > task.priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, task);
  }

  private dispatchNext(): void {
    if (this.queue.length === 0) return;
    if (this.isShuttingDown) return;

    let workerInfo = this.workers.find((w) => w.currentTaskId === null);

    if (!workerInfo && this.workers.length < this.maxWorkers) {
      workerInfo = this.createWorker();
    }

    if (!workerInfo) return;

    const task = this.queue.shift();
    if (!task) return;

    workerInfo.currentTaskId = task.id;
    workerInfo.taskStartedAt = Date.now();
    workerInfo.idleSince = null;

    this.pendingTasks.set(task.id, { task, workerInfo });

    if (this.taskTimeout > 0) {
      task.timeoutId = setTimeout(() => {
        this.handleTaskTimeout(task.id);
      }, this.taskTimeout);
    }

    const message: WorkerTaskMessage<TTask> = {
      type: "task",
      taskId: task.id,
      data: task.data,
    };

    workerInfo.worker.postMessage(message);
  }

  private createWorker(): WorkerInfo {
    const worker = new Worker(this.workerPath);

    const workerInfo: WorkerInfo = {
      worker,
      currentTaskId: null,
      taskStartedAt: null,
      idleSince: Date.now(),
    };

    worker.on("message", (message: WorkerMessage) => {
      this.handleWorkerMessage(workerInfo, message);
    });

    worker.on("error", (error: Error) => {
      this.handleWorkerError(workerInfo, error);
    });

    worker.on("exit", (code: number) => {
      this.handleWorkerExit(workerInfo, code);
    });

    this.workers.push(workerInfo);
    return workerInfo;
  }

  private handleWorkerMessage(
    workerInfo: WorkerInfo,
    message: WorkerMessage
  ): void {
    if (message.type === "ready") {
      this.dispatchNext();
      return;
    }

    const taskId = message.taskId;
    if (!taskId) return;

    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      console.warn(`[WorkerPool] Received message for unknown task: ${taskId}`);
      return;
    }

    const { task } = pending;

    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
      task.timeoutId = undefined;
    }

    this.pendingTasks.delete(taskId);

    workerInfo.currentTaskId = null;
    workerInfo.taskStartedAt = null;
    workerInfo.idleSince = Date.now();

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

    this.dispatchNext();
  }

  private handleWorkerError(workerInfo: WorkerInfo, error: Error): void {
    console.error("[WorkerPool] Worker error:", error);

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

    this.removeWorker(workerInfo);

    if (!this.isShuttingDown && this.queue.length > 0) {
      this.dispatchNext();
    }
  }

  private handleWorkerExit(workerInfo: WorkerInfo, code: number): void {
    if (code !== 0 && !this.isShuttingDown) {
      console.warn(`[WorkerPool] Worker exited with code ${code}`);
    }

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

    if (!this.isShuttingDown && this.queue.length > 0) {
      this.dispatchNext();
    }
  }

  private handleTaskTimeout(taskId: string): void {
    const pending = this.pendingTasks.get(taskId);
    if (!pending) return;

    const { task, workerInfo } = pending;

    this.totalTimedOut++;
    this.pendingTasks.delete(taskId);

    task.reject(new Error(`Task ${taskId} timed out after ${this.taskTimeout}ms`));

    // Terminate stuck worker
    this.removeWorker(workerInfo);

    if (!this.isShuttingDown && this.queue.length > 0) {
      this.dispatchNext();
    }
  }

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
        // Keep at least one worker
        if (
          workerInfo.idleSince !== null &&
          now - workerInfo.idleSince > this.idleTimeout &&
          this.workers.length > 1
        ) {
          this.removeWorker(workerInfo);
        }
      }
    }, 10000);

    this.idleCheckInterval.unref();
  }
}
