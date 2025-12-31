// Attachment URL helpers with failed URL tracking

const failedUrls = new Set<string>();

export const THUMBNAIL_SIZE = 240;
export const PREVIEW_SIZE = 720;

// Returns null if URL has previously failed (404)
export function getFullUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const url = `attachment://file/${localPath}`;
  if (failedUrls.has(url)) return null;
  return url;
}

// Returns null if URL has previously failed (404)
export function getThumbnailUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const url = `attachment://file/${localPath}?size=${THUMBNAIL_SIZE}`;
  if (failedUrls.has(url)) return null;
  return url;
}

// Returns null if URL has previously failed (404)
export function getPreviewUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const url = `attachment://file/${localPath}?size=${PREVIEW_SIZE}`;
  if (failedUrls.has(url)) return null;
  return url;
}

export function markUrlFailed(url: string): void {
  failedUrls.add(url);
}

export function hasUrlFailed(url: string): boolean {
  return failedUrls.has(url);
}

export function clearFailedUrls(): void {
  failedUrls.clear();
}

export function getFailedUrlCount(): number {
  return failedUrls.size;
}
