import { memo } from 'react';
import type { Attachment } from '@/types';
import { ImageAttachment } from './image-attachment';
import { VideoAttachment } from './video-attachment';
import { AudioAttachment } from './audio-attachment';
import { StickerAttachment } from './sticker-attachment';
import { DocumentAttachment } from './document-attachment';
import { GenericAttachment } from './generic-attachment';
import { UnavailableAttachment } from './unavailable-attachment';

type AttachmentRendererProps = {
  attachment: Attachment;
  dimensions?: { width: number; height: number };
  onOpenLightbox?: () => void;
};

export const AttachmentRenderer = memo(function AttachmentRenderer({
  attachment,
  dimensions,
  onOpenLightbox,
}: AttachmentRendererProps) {
  // If no local path, show unavailable
  if (!attachment.localPath) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  switch (attachment.type) {
    case 'image':
      return (
        <ImageAttachment
          attachment={attachment}
          dimensions={dimensions}
          onOpenLightbox={onOpenLightbox}
        />
      );

    case 'video':
      return (
        <VideoAttachment
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
      return <DocumentAttachment attachment={attachment} />;

    default:
      return <GenericAttachment attachment={attachment} />;
  }
});
