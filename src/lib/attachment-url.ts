// Global cache for failed attachment URLs
// Prevents infinite retry loops when files are missing (404)

// Track URLs that have returned 404 - survives component unmount/remount
const failedUrls = new Set<string>();

// Thumbnail size for gallery grid (2x for retina displays)
export const THUMBNAIL_SIZE = 240;

/**
 * Construct thumbnail URL synchronously.
 * Returns null if the URL has previously failed (404).
 */
export function getThumbnailUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const url = `attachment://file/${localPath}?size=${THUMBNAIL_SIZE}`;
  if (failedUrls.has(url)) return null; // Already failed, skip retry
  return url;
}

/**
 * Mark a URL as failed (404).
 * Called from onError handler when image fails to load.
 */
export function markUrlFailed(url: string): void {
  failedUrls.add(url);
}

/**
 * Check if a URL has failed.
 */
export function hasUrlFailed(url: string): boolean {
  return failedUrls.has(url);
}

/**
 * Clear the failed URL cache.
 * Useful if user wants to retry loading missing files.
 */
export function clearFailedUrls(): void {
  failedUrls.clear();
}

/**
 * Get count of failed URLs (for debugging).
 */
export function getFailedUrlCount(): number {
  return failedUrls.size;
}
