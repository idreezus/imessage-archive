import { memo } from 'react';
import { File, Download } from 'lucide-react';
import type { Attachment } from '@/types';
import {
  formatFileSize,
  getDisplayName,
  getFileExtension,
} from '@/lib/attachments';
import { getFullUrl } from '@/lib/attachment-url';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type GenericAttachmentProps = {
  attachment: Attachment;
};

export const GenericAttachment = memo(function GenericAttachment({
  attachment,
}: GenericAttachmentProps) {
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

  const extension = getFileExtension(attachment);

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left"
      >
        <div className="relative w-10 h-10 shrink-0">
          <File className="w-10 h-10 text-muted-foreground" />
          {extension && (
            <span className="absolute -bottom-1 -right-1 text-[10px] font-bold uppercase bg-foreground text-background px-1 rounded">
              {extension}
            </span>
          )}
        </div>
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
