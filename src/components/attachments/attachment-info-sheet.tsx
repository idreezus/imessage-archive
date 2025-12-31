import { memo, useEffect, useState } from 'react';
import { Download, Share, FolderOpen } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Skeleton } from '@/components/ui/skeleton';
import type { Attachment } from '@/types';
import type { AttachmentMetadata } from '@/types/gallery';
import { formatFileSize, getDisplayName } from '@/lib/attachments';
import { useAttachmentActions } from '@/hooks/use-attachment-actions';
import { format } from 'date-fns';

type AttachmentInfoSheetProps = {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
};

type MetadataRowProps = {
  label: string;
  value: string | null | undefined;
};

function MetadataRow({ label, value }: MetadataRowProps) {
  if (!value) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono tracking-tight text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium break-all">{value}</span>
    </div>
  );
}

function MetadataRowSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

function formatDate(timestamp: number | null): string | null {
  if (!timestamp) return null;
  return format(new Date(timestamp), 'MMM d, yyyy, h:mm a');
}

const TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  'voice-memo': 'Voice Memo',
  sticker: 'Sticker',
  document: 'Document',
  other: 'File',
};

export const AttachmentInfoSheet = memo(function AttachmentInfoSheet({
  attachment,
  isOpen,
  onClose,
}: AttachmentInfoSheetProps) {
  const [metadata, setMetadata] = useState<AttachmentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { download, share, showInFinder, isDownloading, isSharing } =
    useAttachmentActions(attachment);

  useEffect(() => {
    if (!isOpen || !attachment) {
      setMetadata(null);
      return;
    }

    setIsLoading(true);
    window.electronAPI
      .getAttachmentMetadata(attachment.rowid)
      .then((data) => setMetadata(data))
      .catch((err) => console.error('Failed to load metadata:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, attachment]);

  if (!attachment) return null;

  const displayName = getDisplayName(attachment);
  const typeLabel = TYPE_LABELS[attachment.type] || 'File';
  const hasLocalPath = Boolean(attachment.localPath);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader className="border-b">
          <SheetTitle className="text-base font-medium">File Info</SheetTitle>
          <SheetDescription>
            Details and metadata for this attachment
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="flex flex-col gap-5 py-6">
              <MetadataRowSkeleton />
              <MetadataRowSkeleton />
              <MetadataRowSkeleton />
              <MetadataRowSkeleton />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <MetadataRow label="Filename" value={displayName} />
              <MetadataRow label="Type" value={typeLabel} />
              <MetadataRow
                label="Size"
                value={formatFileSize(attachment.totalBytes)}
              />
              <MetadataRow label="MIME" value={attachment.mimeType} />
              <MetadataRow
                label="Date"
                value={formatDate(metadata?.messageDate ?? null)}
              />
              <MetadataRow
                label="From"
                value={
                  metadata?.isFromMe
                    ? 'You'
                    : metadata?.senderHandle || undefined
                }
              />
              <MetadataRow
                label="Conversation"
                value={metadata?.chatDisplayName}
              />
              <MetadataRow label="Path" value={metadata?.absolutePath} />
            </div>
          )}
        </div>

        {hasLocalPath && (
          <SheetFooter className="border-t pt-4 px-4">
            <ButtonGroup className="w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={download}
                disabled={isDownloading}
                className="flex-1"
              >
                <Download className="size-4" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={share}
                disabled={isSharing}
                className="flex-1"
              >
                <Share className="size-4" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={showInFinder}
                className="flex-1"
              >
                <FolderOpen className="size-4" />
                Finder
              </Button>
            </ButtonGroup>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
});
