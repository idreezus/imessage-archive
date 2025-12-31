// Persistent cache for original image/video dimensions
// Used to prevent layout shift by knowing dimensions before image loads

import * as fs from "fs";
import * as path from "path";

type Dimensions = { width: number; height: number };

const CACHE_FILE = path.join(process.cwd(), "data/caches/dimensions-cache.json");

let cache: Map<string, Dimensions> = new Map();
let dirty = false;
let saveTimeout: NodeJS.Timeout | null = null;

// Debounce interval for saving cache to disk
const SAVE_DEBOUNCE_MS = 5000;

// Get dimensions for a single path
export function getDimensions(localPath: string): Dimensions | null {
  return cache.get(localPath) ?? null;
}

// Set dimensions for a path and schedule save
export function setDimensions(
  localPath: string,
  width: number,
  height: number
): void {
  if (width <= 0 || height <= 0) return;

  cache.set(localPath, { width, height });
  dirty = true;
  scheduleSave();
}

// Get dimensions for multiple paths in batch
export function getBatch(localPaths: string[]): Record<string, Dimensions> {
  const result: Record<string, Dimensions> = {};

  for (const localPath of localPaths) {
    const dims = cache.get(localPath);
    if (dims) {
      result[localPath] = dims;
    }
  }

  return result;
}

// Load cache from disk on startup
export async function loadDimensionsCache(): Promise<void> {
  try {
    const data = await fs.promises.readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(data) as Record<string, Dimensions>;

    cache = new Map(Object.entries(parsed));
    dirty = false;

    console.log(`[dimensions-cache] Loaded ${cache.size} cached dimensions`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[dimensions-cache] Failed to load cache:", error);
    }
    cache = new Map();
  }
}

// Save cache to disk
export async function saveDimensionsCache(): Promise<void> {
  if (!dirty) return;

  try {
    // Ensure cache directory exists
    const cacheDir = path.dirname(CACHE_FILE);
    await fs.promises.mkdir(cacheDir, { recursive: true });

    const data = JSON.stringify(Object.fromEntries(cache));
    await fs.promises.writeFile(CACHE_FILE, data, "utf-8");

    dirty = false;
    console.log(`[dimensions-cache] Saved ${cache.size} dimensions to disk`);
  } catch (error) {
    console.error("[dimensions-cache] Failed to save cache:", error);
  }
}

// Schedule a debounced save
function scheduleSave(): void {
  if (saveTimeout) return;

  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    await saveDimensionsCache();
  }, SAVE_DEBOUNCE_MS);
}

// Clear pending save timeout (for clean shutdown)
export function clearPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}
