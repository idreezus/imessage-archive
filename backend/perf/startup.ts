import { isPerfEnabled } from "./config";
import { logStartupTable } from "./logger";

type StartupPhase = { name: string; duration: number };

const phases: StartupPhase[] = [];
let currentPhase: { name: string; start: number } | null = null;

/**
 * Start timing a startup phase.
 * Automatically ends the previous phase if one was in progress.
 */
export function startPhase(name: string): void {
  if (!isPerfEnabled()) return;

  // End previous phase if exists
  if (currentPhase) {
    phases.push({
      name: currentPhase.name,
      duration: Math.round(performance.now() - currentPhase.start),
    });
  }

  currentPhase = { name, start: performance.now() };
}

/**
 * End the startup timing and log the summary table.
 * Should be called after all startup phases are complete.
 */
export function endStartup(): void {
  if (!isPerfEnabled()) return;

  // End final phase
  if (currentPhase) {
    phases.push({
      name: currentPhase.name,
      duration: Math.round(performance.now() - currentPhase.start),
    });
    currentPhase = null;
  }

  logStartupTable(phases);
}
