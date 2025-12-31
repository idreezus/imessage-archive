import { memo, useState, useCallback } from 'react';
import type { Attachment } from '@/types';
import { getFullUrl, markUrlFailed } from '@/lib/attachment-url';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type StickerAttachmentProps = {
  attachment: Attachment;
};

export const StickerAttachment = memo(function StickerAttachment({
  attachment,
}: StickerAttachmentProps) {
  const [error, setError] = useState(false);

  // Synchronous URL construction - no async, no IPC
  const imageUrl = getFullUrl(attachment.localPath);

  const handleError = useCallback(() => {
    if (imageUrl) {
      markUrlFailed(imageUrl);
    }
    setError(true);
  }, [imageUrl]);

  if (error || !imageUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <AttachmentContextMenu attachment={attachment}>
      <div className="inline-block p-1 bg-muted/30 rounded-lg">
        <img
          src={imageUrl}
          alt={attachment.transferName || 'Sticker'}
          className="object-contain"
          style={{ maxWidth: 120, maxHeight: 120 }}
          loading="lazy"
          onError={handleError}
        />
      </div>
    </AttachmentContextMenu>
  );
});
