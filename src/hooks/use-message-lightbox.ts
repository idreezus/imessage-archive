import { useState, useCallback } from 'react';
import type { Attachment } from '@/types';

type UseMessageLightboxResult = {
  lightboxOpen: boolean;
  lightboxIndex: number;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
};

// Manages lightbox state for viewing media attachments.
export function useMessageLightbox(mediaAttachments: Attachment[]): UseMessageLightboxResult {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    const attachment = mediaAttachments[index];
    if (!attachment) return;

    const lightboxIdx = mediaAttachments.findIndex((a) => a.rowid === attachment.rowid);
    if (lightboxIdx !== -1) {
      setLightboxIndex(lightboxIdx);
      setLightboxOpen(true);
    }
  }, [mediaAttachments]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  return {
    lightboxOpen,
    lightboxIndex,
    openLightbox,
    closeLightbox,
  };
}
