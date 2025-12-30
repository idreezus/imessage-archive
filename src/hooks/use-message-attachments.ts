import { useMemo } from 'react';
import type { Attachment } from '@/types';

type UseMessageAttachmentsResult = {
  mediaAttachments: Attachment[];
  nonMediaAttachments: Attachment[];
  hasMediaAttachments: boolean;
  hasNonMediaAttachments: boolean;
};

// Separates attachments into media (images/videos) and non-media categories.
// Media attachments are rendered standalone (like iMessage), non-media inside bubbles.
export function useMessageAttachments(attachments: Attachment[] | undefined): UseMessageAttachmentsResult {
  return useMemo(() => {
    if (!attachments || attachments.length === 0) {
      return {
        mediaAttachments: [],
        nonMediaAttachments: [],
        hasMediaAttachments: false,
        hasNonMediaAttachments: false,
      };
    }

    const media: Attachment[] = [];
    const nonMedia: Attachment[] = [];

    for (const attachment of attachments) {
      if (attachment.type === 'image' || attachment.type === 'video') {
        media.push(attachment);
      } else {
        nonMedia.push(attachment);
      }
    }

    return {
      mediaAttachments: media,
      nonMediaAttachments: nonMedia,
      hasMediaAttachments: media.length > 0,
      hasNonMediaAttachments: nonMedia.length > 0,
    };
  }, [attachments]);
}
