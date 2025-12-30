// Performance monitoring feature flag
// Disabled by default - enable with VITE_PERF_ENABLED=true environment variable

let _enabled: boolean | null = null;

export function isPerfEnabled(): boolean {
  if (_enabled === null) {
    _enabled = import.meta.env.VITE_PERF_ENABLED === "true";
  }
  return _enabled;
}

export type PerfCategory = "ipc" | "render" | "hook";
