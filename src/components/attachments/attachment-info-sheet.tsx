import { memo, useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { Attachment } from '@/types';
import type { AttachmentMetadata } from '@/types/gallery';
import { formatFileSize, getDisplayName } from '@/lib/attachments';
import { format } from 'date-fns';

type AttachmentInfoSheetProps = {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
};

type InfoRowProps = {
  label: string;
  value: string | null | undefined;
  copyable?: boolean;
};

function InfoRow({ label, value, copyable }: InfoRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!value) return null;

  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm break-all">{value}</span>
        {copyable && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="size-3 text-green-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Unknown';
  return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
}

function getTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    'voice-memo': 'Voice Memo',
    sticker: 'Sticker',
    document: 'Document',
    other: 'File',
  };
  return typeNames[type] || 'File';
}

export const AttachmentInfoSheet = memo(function AttachmentInfoSheet({
  attachment,
  isOpen,
  onClose,
}: AttachmentInfoSheetProps) {
  const [metadata, setMetadata] = useState<AttachmentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>File Info</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="space-y-1">
            <InfoRow label="Filename" value={getDisplayName(attachment)} />
            <Separator />

            <InfoRow label="Type" value={getTypeName(attachment.type)} />
            <Separator />

            <InfoRow
              label="Size"
              value={formatFileSize(attachment.totalBytes)}
            />
            <Separator />

            {attachment.mimeType && (
              <>
                <InfoRow label="MIME Type" value={attachment.mimeType} />
                <Separator />
              </>
            )}

            {metadata?.messageDate && (
              <>
                <InfoRow
                  label="Date"
                  value={formatDate(metadata.messageDate)}
                />
                <Separator />
              </>
            )}

            <InfoRow
              label="From"
              value={
                metadata?.isFromMe
                  ? 'You'
                  : metadata?.senderHandle || 'Unknown'
              }
            />
            <Separator />

            {metadata?.chatDisplayName && (
              <>
                <InfoRow
                  label="Conversation"
                  value={metadata.chatDisplayName}
                />
                <Separator />
              </>
            )}

            {metadata?.absolutePath && (
              <InfoRow
                label="Path"
                value={metadata.absolutePath}
                copyable
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
});
