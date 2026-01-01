import { useState, useCallback } from 'react';

type UseLightboxResult = {
  lightboxOpen: boolean;
  lightboxIndex: number;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
};

// Manages lightbox state for viewing media attachments
// Works with both Message attachments and GalleryAttachments
export function useLightbox<T extends { rowid: number }>(
  mediaItems: T[]
): UseLightboxResult {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback(
    (index: number) => {
      const item = mediaItems[index];
      if (!item) return;

      const lightboxIdx = mediaItems.findIndex((a) => a.rowid === item.rowid);
      if (lightboxIdx !== -1) {
        setLightboxIndex(lightboxIdx);
        setLightboxOpen(true);
      }
    },
    [mediaItems]
  );

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
