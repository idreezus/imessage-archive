import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Cache directory for generated thumbnails
function getCacheDir(): string {
  return path.join(__dirname, "..", "..", "data", "caches", "attachments");
}

// In-memory LRU cache for hot thumbnails (100 items max, ~1.5MB at 15KB each)
const MEMORY_CACHE_SIZE = 100;
const memoryCache = new Map<string, Buffer>();

function memoryGet(key: string): Buffer | undefined {
  const value = memoryCache.get(key);
  if (value !== undefined) {
    // Move to end (most recently used)
    memoryCache.delete(key);
    memoryCache.set(key, value);
  }
  return value;
}

function memorySet(key: string, value: Buffer): void {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MEMORY_CACHE_SIZE) {
    // Delete oldest (first) entry
    const firstKey = memoryCache.keys().next().value;
    if (firstKey !== undefined) {
      memoryCache.delete(firstKey);
    }
  }
  memoryCache.set(key, value);
}

// Generate a deterministic cache key from file path and size
export function getCacheKey(filePath: string, size: number): string {
  return (
    crypto.createHash("sha256").update(`${filePath}:${size}`).digest("hex") +
    ".webp"
  );
}

// Read thumbnail from memory cache first, then disk cache
export async function readFromCache(cacheKey: string): Promise<Buffer | null> {
  // L1: Memory cache (fastest)
  const memCached = memoryGet(cacheKey);
  if (memCached) {
    return memCached;
  }

  // L2: Disk cache
  try {
    const cacheDir = getCacheDir();
    const fullPath = path.join(cacheDir, cacheKey);

    // Security: Ensure path is within cache directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedBase = path.resolve(cacheDir);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return null;
    }

    const buffer = await fs.promises.readFile(fullPath);

    // Promote to memory cache
    memorySet(cacheKey, buffer);

    return buffer;
  } catch {
    return null;
  }
}

// Write thumbnail to both memory and disk cache
export async function writeToCache(
  cacheKey: string,
  buffer: Buffer
): Promise<void> {
  // Always write to memory cache first
  memorySet(cacheKey, buffer);

  // Then write to disk cache
  const cacheDir = getCacheDir();
  const fullPath = path.join(cacheDir, cacheKey);

  // Security: Ensure path is within cache directory
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(cacheDir);
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error("Invalid cache path");
  }

  // Create directory if needed
  await fs.promises.mkdir(cacheDir, { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);
}
