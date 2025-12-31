// Worker pool type definitions

export interface WorkerPoolOptions {
  workerPath: string;
  maxWorkers?: number;
  taskTimeout?: number;
  idleTimeout?: number;
}

export interface QueuedTask<TData> {
  id: string;
  data: TData;
  priority: number;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
  queuedAt: number;
}

export interface WorkerInfo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worker: any;
  currentTaskId: string | null;
  taskStartedAt: number | null;
  idleSince: number | null;
}

export interface WorkerTaskMessage<TData> {
  type: "task";
  taskId: string;
  data: TData;
}

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

export interface PoolStats {
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  totalProcessed: number;
  totalFailed: number;
  totalTimedOut: number;
}
