// Hook to manage indexing state and subscribe to progress updates

import { useEffect, useState, useCallback } from 'react';
import type { IndexingProgress } from '@/types/electron.d';

const BLOCKING_THRESHOLD = 100;

type IndexingStatus = {
  isLoading: boolean;
  unindexedCount: number;
  shouldBlock: boolean;
  isIndexing: boolean;
  progress: IndexingProgress | null;
  startIndexing: () => Promise<void>;
};

export function useIndexingStatus(): IndexingStatus {
  const [isLoading, setIsLoading] = useState(true);
  const [unindexedCount, setUnindexedCount] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState<IndexingProgress | null>(null);

  // Check initial state on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const [count, inProgress, currentProgress] = await Promise.all([
          window.electronAPI.getUnindexedCount(),
          window.electronAPI.isIndexingInProgress(),
          window.electronAPI.getIndexingProgress(),
        ]);

        setUnindexedCount(count);
        setIsIndexing(inProgress);
        if (inProgress) {
          setProgress(currentProgress);
        }
      } catch (err) {
        console.error('[useIndexingStatus] Failed to check status:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
  }, []);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.onIndexingProgress((update) => {
      setProgress(update);
      setIsIndexing(update.phase !== 'complete' && update.phase !== 'error');

      // Update count when complete
      if (update.phase === 'complete') {
        setUnindexedCount(0);
      }
    });

    return unsubscribe;
  }, []);

  const startIndexing = useCallback(async () => {
    setIsIndexing(true);
    try {
      await window.electronAPI.startIndexing();
    } catch (err) {
      console.error('[useIndexingStatus] Failed to start indexing:', err);
      setIsIndexing(false);
    }
  }, []);

  return {
    isLoading,
    unindexedCount,
    shouldBlock: unindexedCount >= BLOCKING_THRESHOLD,
    isIndexing,
    progress,
    startIndexing,
  };
}
