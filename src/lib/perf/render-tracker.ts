import { useEffect, useRef } from "react";
import { isPerfEnabled } from "./config";
import { log } from "./logger";

/**
 * Hook to track component render time.
 * Logs the time from render start to after effects run.
 */
export function useRenderTiming(
  componentName: string,
  metadata?: Record<string, unknown>
): void {
  const renderStart = useRef(performance.now());

  useEffect(() => {
    if (!isPerfEnabled()) return;

    const duration = Math.round(performance.now() - renderStart.current);
    log("render", componentName, duration, metadata);
  });

  // Reset timer on each render
  renderStart.current = performance.now();
}

/**
 * Measure a synchronous operation within a component.
 * Returns the result of the operation.
 */
export function measureSync<T>(
  operationName: string,
  operation: () => T
): T {
  if (!isPerfEnabled()) return operation();

  const start = performance.now();
  const result = operation();
  const duration = Math.round(performance.now() - start);
  log("hook", operationName, duration);
  return result;
}
