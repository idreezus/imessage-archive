// Performance monitoring feature flag
// Disabled by default - enable with PERF_ENABLED=true environment variable

let _enabled: boolean | null = null;

export function isPerfEnabled(): boolean {
  if (_enabled === null) {
    _enabled = process.env.PERF_ENABLED === "true";
  }
  return _enabled;
}

export type PerfCategory = "startup" | "ipc" | "db" | "search" | "attachment";
