import { memo, useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import type { Attachment } from '@/types';
import { formatFileSize, getDisplayName } from '@/lib/attachments';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type DocumentAttachmentProps = {
  attachment: Attachment;
};

export const DocumentAttachment = memo(function DocumentAttachment({
  attachment,
}: DocumentAttachmentProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!attachment.localPath) {
      setError(true);
      setIsLoading(false);
      return;
    }

    window.electronAPI
      .getAttachmentFileUrl(attachment.localPath)
      .then((url) => {
        if (url) {
          setFileUrl(url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [attachment.localPath]);

  const handleOpen = () => {
    if (fileUrl) {
      window.open(fileUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg h-16 w-48" />
    );
  }

  if (error || !fileUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left"
      >
        <FileText className="w-10 h-10 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {getDisplayName(attachment)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.totalBytes)}
          </p>
        </div>
        <Download className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </button>
    </AttachmentContextMenu>
  );
});
