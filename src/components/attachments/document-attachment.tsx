import { memo } from 'react';
import { FileText, Download } from 'lucide-react';
import type { Attachment } from '@/types';
import { formatFileSize, getDisplayName } from '@/lib/attachments';
import { getFullUrl } from '@/lib/attachment-url';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type DocumentAttachmentProps = {
  attachment: Attachment;
};

export const DocumentAttachment = memo(function DocumentAttachment({
  attachment,
}: DocumentAttachmentProps) {
  // Synchronous URL construction - no async, no IPC
  const fileUrl = getFullUrl(attachment.localPath);

  const handleOpen = () => {
    if (fileUrl) {
      window.open(fileUrl);
    }
  };

  if (!fileUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left"
      >
        <FileText className="w-10 h-10 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {getDisplayName(attachment)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.totalBytes)}
          </p>
        </div>
        <Download className="w-5 h-5 text-muted-foreground shrink-0" />
      </button>
    </AttachmentContextMenu>
  );
});
