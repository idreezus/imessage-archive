import { useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { IndexingDialog } from '@/components/indexing';
import { useIndexingStatus } from '@/hooks/use-indexing-status';

// Root application component with media indexing check at startup.
export function App() {
  const {
    isLoading,
    shouldBlock,
    isIndexing,
    progress,
    startIndexing,
    unindexedCount,
  } = useIndexingStatus();

  // Auto-start indexing when component mounts and there are unindexed attachments
  useEffect(() => {
    if (isLoading) return;
    if (unindexedCount === 0) return;
    if (isIndexing) return;

    startIndexing();
  }, [isLoading, unindexedCount, isIndexing, startIndexing]);

  // Show loading state while checking unindexed count
  if (isLoading) {
    return null;
  }

  // Show blocking dialog if threshold exceeded and still indexing
  const showBlockingDialog = shouldBlock && isIndexing;

  return (
    <>
      <IndexingDialog open={showBlockingDialog} progress={progress} />
      {!showBlockingDialog && <AppLayout />}
    </>
  );
}

export default App;
