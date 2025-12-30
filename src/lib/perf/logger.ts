import { isPerfEnabled } from "./config";
import type { PerfCategory } from "./config";

// Noop timer for when perf is disabled
const noopTimer = { end: () => 0 };

/**
 * Get current timestamp in HH:MM:SS.mmm format
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const millis = now.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

/**
 * Log a performance measurement to console.
 * Format: [PERF] [HH:MM:SS.mmm] [CATEGORY] operation: XXXms {metadata}
 */
export function log(
  category: PerfCategory,
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  if (!isPerfEnabled()) return;

  const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console.log(
    `[PERF] [${getTimestamp()}] [${category.toUpperCase()}] ${operation}: ${durationMs}ms${metaStr}`
  );
}

/**
 * Start a timer for measuring operation duration.
 * Returns an object with end() method that logs and returns the duration.
 */
export function startTimer(
  category: PerfCategory,
  operation: string
): { end: (metadata?: Record<string, unknown>) => number } {
  if (!isPerfEnabled()) return noopTimer;

  const start = performance.now();
  return {
    end: (metadata?: Record<string, unknown>) => {
      const duration = Math.round(performance.now() - start);
      log(category, operation, duration, metadata);
      return duration;
    },
  };
}
