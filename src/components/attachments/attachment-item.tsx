import { memo } from 'react';
import type { Attachment } from '@/types';
import { MediaAttachment } from './media-attachment';
import { AudioAttachment } from './audio-attachment';
import { StickerAttachment } from './sticker-attachment';
import { FileAttachment } from './file-attachment';
import { UnavailableAttachment } from './unavailable-attachment';

type AttachmentItemProps = {
  attachment: Attachment;
  dimensions?: { width: number; height: number };
  onOpenLightbox?: () => void;
};

// Type router that delegates to appropriate attachment renderer
export const AttachmentItem = memo(function AttachmentItem({
  attachment,
  dimensions,
  onOpenLightbox,
}: AttachmentItemProps) {
  // If no local path, show unavailable
  if (!attachment.localPath) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  switch (attachment.type) {
    case 'image':
    case 'video':
      return (
        <MediaAttachment
          attachment={attachment}
          dimensions={dimensions}
          onOpenLightbox={onOpenLightbox}
        />
      );

    case 'voice-memo':
      return <AudioAttachment attachment={attachment} isVoiceMemo />;

    case 'audio':
      return <AudioAttachment attachment={attachment} />;

    case 'sticker':
      return <StickerAttachment attachment={attachment} />;

    case 'document':
    default:
      return <FileAttachment attachment={attachment} />;
  }
});
