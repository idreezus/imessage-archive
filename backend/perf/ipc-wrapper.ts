import { ipcMain, IpcMainInvokeEvent } from "electron";
import { isPerfEnabled } from "./config";
import { startTimer } from "./logger";

type IpcHandler<T, R> = (
  event: IpcMainInvokeEvent,
  args: T
) => Promise<R> | R;

/**
 * Summarize arguments for logging (avoid logging huge objects).
 */
function summarizeArgs(args: unknown): Record<string, unknown> | undefined {
  if (!args || typeof args !== "object") return undefined;

  const obj = args as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      summary[key] = `[${value.length} items]`;
    }
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

/**
 * Wrap an IPC handler with performance timing.
 * Returns the original handler unchanged when perf is disabled.
 */
export function wrapIpcHandler<T, R>(
  channel: string,
  handler: IpcHandler<T, R>
): IpcHandler<T, R> {
  if (!isPerfEnabled()) return handler;

  return async (event, args) => {
    const timer = startTimer("ipc", channel);
    try {
      const result = await handler(event, args);
      timer.end(summarizeArgs(args));
      return result;
    } catch (error) {
      timer.end({ error: true, ...summarizeArgs(args) });
      throw error;
    }
  };
}

/**
 * Register an IPC handler with automatic performance timing.
 * Equivalent to ipcMain.handle() but with timing when PERF_ENABLED=true.
 */
export function handleWithTiming<T, R>(
  channel: string,
  handler: IpcHandler<T, R>
): void {
  ipcMain.handle(channel, wrapIpcHandler(channel, handler));
}
