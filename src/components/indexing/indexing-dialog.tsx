// Blocking dialog shown when >= 100 attachments need indexing

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { IndexingProgress } from '@/types/electron.d';

type IndexingDialogProps = {
  open: boolean;
  progress: IndexingProgress | null;
};

export function IndexingDialog({ open, progress }: IndexingDialogProps) {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  const statusText =
    progress?.phase === 'scanning'
      ? 'Scanning for media...'
      : progress?.phase === 'indexing'
        ? `Indexing media: ${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()}`
        : progress?.phase === 'error'
          ? `Error: ${progress.error}`
          : 'Preparing...';

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preparing Media Library</DialogTitle>
          <DialogDescription>
            Indexing attachment dimensions for smooth gallery loading. This only
            happens once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={percent} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {statusText}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
