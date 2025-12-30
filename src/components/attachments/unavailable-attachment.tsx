import { memo } from 'react';
import { FileX } from 'lucide-react';
import type { Attachment } from '@/types';
import { getDisplayName } from '@/lib/attachments';

type UnavailableAttachmentProps = {
  attachment: Attachment;
};

export const UnavailableAttachment = memo(function UnavailableAttachment({
  attachment,
}: UnavailableAttachmentProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-muted-foreground">
      <FileX className="w-5 h-5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm">Attachment unavailable</p>
        <p className="text-xs truncate opacity-70">{getDisplayName(attachment)}</p>
      </div>
    </div>
  );
});
