import { useEffect, useState, useRef, useMemo } from 'react';
import type { Attachment } from '@/types';

type DimensionsMap = Record<string, { width: number; height: number }>;

// In-memory cache persists across component mounts
const memoryCache: DimensionsMap = {};

// Prefetches and caches attachment dimensions to prevent layout shift.
// Returns a map of localPath -> { width, height } for all attachments that have cached dimensions.
export function useAttachmentDimensions(attachments: Attachment[]): DimensionsMap {
  const [fetchedDimensions, setFetchedDimensions] = useState<DimensionsMap>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  // Filter to only image/video attachments with valid localPaths
  const visualPaths = useMemo(
    () =>
      attachments
        .filter((a) => a.localPath && (a.type === 'image' || a.type === 'video'))
        .map((a) => a.localPath!),
    [attachments]
  );

  // Compute cached dimensions synchronously (no effect needed)
  const cachedDimensions = useMemo(() => {
    const cached: DimensionsMap = {};
    for (const path of visualPaths) {
      if (memoryCache[path]) {
        cached[path] = memoryCache[path];
      }
    }
    return cached;
  }, [visualPaths]);

  useEffect(() => {
    if (visualPaths.length === 0) return;

    // Find paths not yet cached or fetched
    const uncachedPaths = visualPaths.filter(
      (path) => !memoryCache[path] && !fetchedRef.current.has(path)
    );

    if (uncachedPaths.length === 0) return;

    // Mark paths as being fetched to avoid duplicate requests
    uncachedPaths.forEach((p) => fetchedRef.current.add(p));

    // Fetch uncached dimensions from backend
    window.electronAPI.getAttachmentDimensions(uncachedPaths).then((result) => {
      // Store in memory cache
      Object.assign(memoryCache, result);

      // Update state if we got any dimensions
      if (Object.keys(result).length > 0) {
        setFetchedDimensions((prev) => ({ ...prev, ...result }));
      }
    });
  }, [visualPaths]);

  // Merge cached and fetched dimensions
  return useMemo(
    () => ({ ...cachedDimensions, ...fetchedDimensions }),
    [cachedDimensions, fetchedDimensions]
  );
}
