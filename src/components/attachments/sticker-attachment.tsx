import { memo, useState, useEffect } from 'react';
import type { Attachment } from '@/types';
import { UnavailableAttachment } from './unavailable-attachment';

type StickerAttachmentProps = {
  attachment: Attachment;
};

export const StickerAttachment = memo(function StickerAttachment({
  attachment,
}: StickerAttachmentProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
          setImageUrl(url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [attachment.localPath]);

  if (isLoading) {
    return (
      <div className="animate-pulse bg-muted/50 rounded-lg w-[120px] h-[120px]" />
    );
  }

  if (error || !imageUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <div className="inline-block p-1 bg-muted/30 rounded-lg">
      <img
        src={imageUrl}
        alt={attachment.transferName || 'Sticker'}
        className="object-contain"
        style={{ maxWidth: 120, maxHeight: 120 }}
        loading="lazy"
      />
    </div>
  );
});
