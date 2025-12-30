// Performance monitoring utilities for backend
export { isPerfEnabled, type PerfCategory } from "./config";
export { log, startTimer, logStartupTable } from "./logger";
export { wrapIpcHandler, handleWithTiming } from "./ipc-wrapper";
export { startPhase, endStartup } from "./startup";
