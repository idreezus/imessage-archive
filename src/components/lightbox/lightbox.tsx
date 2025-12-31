import { memo, useState, useEffect, useCallback, useRef } from 'react';
import type { Attachment } from '@/types';
import { LightboxHeader } from './lightbox-header';
import { LightboxMedia } from './lightbox-media';
import { LightboxNavigation } from './lightbox-navigation';
import { LightboxFilmstrip } from './lightbox-filmstrip';
import { LightboxToolbar } from './lightbox-toolbar';
import { AttachmentInfoSheet } from '../attachments/attachment-info-sheet';

type LightboxProps = {
  attachments: Attachment[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  showToolbar?: boolean;
};

export const Lightbox = memo(function Lightbox({
  attachments,
  initialIndex,
  isOpen,
  onClose,
  showToolbar = false,
}: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = attachments[currentIndex];
  const hasMultiple = attachments.length > 1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < attachments.length - 1;

  // Reset index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Load current media URL
  useEffect(() => {
    if (!current?.localPath || !isOpen) {
      setMediaUrl(null);
      return;
    }

    setIsLoading(true);
    window.electronAPI
      .getAttachmentFileUrl(current.localPath)
      .then((url) => setMediaUrl(url))
      .finally(() => setIsLoading(false));
  }, [current?.localPath, isOpen]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentIndex((i) => i - 1);
    }
  }, [hasPrev]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex((i) => i + 1);
    }
  }, [hasNext]);

  const toggleVideoPlayback = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case ' ':
          e.preventDefault();
          toggleVideoPlayback();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToPrev, goToNext, toggleVideoPlayback]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsInfoOpen(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col pb-lightbox-bottom-padding">
      <LightboxHeader onClose={onClose} />

      <div
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden relative px-lightbox-x-padding"
        onClick={onClose}
      >
        {hasMultiple && (
          <LightboxNavigation
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={goToPrev}
            onNext={goToNext}
          />
        )}

        <LightboxMedia
          attachment={current}
          mediaUrl={mediaUrl}
          isLoading={isLoading}
          videoRef={videoRef}
        />
      </div>

      {showToolbar && current && (
        <div className="shrink-0 h-lightbox-toolbar flex items-center justify-center">
          <LightboxToolbar
            attachment={current}
            onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
            isInfoOpen={isInfoOpen}
          />
        </div>
      )}

      {hasMultiple && (
        <LightboxFilmstrip
          attachments={attachments}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
        />
      )}

      <AttachmentInfoSheet
        attachment={current}
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </div>
  );
});
