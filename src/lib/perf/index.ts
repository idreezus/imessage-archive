// Performance monitoring utilities for frontend
export { isPerfEnabled, type PerfCategory } from "./config";
export { log, startTimer } from "./logger";
export { trackIpcCall, createTrackedApi } from "./ipc-tracker";
export { useRenderTiming, measureSync } from "./render-tracker";
