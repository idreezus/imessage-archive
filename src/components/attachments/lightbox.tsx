import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getThumbnailUrl, markUrlFailed } from '@/lib/attachment-url';
import { Button } from '@/components/ui/button';
import { LightboxToolbar } from './lightbox-toolbar';
import { AttachmentInfoSheet } from './attachment-info-sheet';

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
  const [failedThumbnails, setFailedThumbnails] = useState<Set<number>>(
    new Set()
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

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

  // Auto-scroll to keep current thumbnail visible
  useEffect(() => {
    if (!hasMultiple) return;
    const currentRef = thumbnailRefs.current.get(
      attachments[currentIndex]?.rowid
    );
    currentRef?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentIndex, attachments, hasMultiple]);

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
    // {/* Fullscreen overlay */}
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col pb-lightbox-bottom-padding">
      {/* Header */}
      <div className="shrink-0 h-lightbox-header flex items-center justify-end px-lightbox-x-padding">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20 hover:text-white"
        >
          <X className="size-6" />
        </Button>
      </div>

      {/* Content area */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden relative px-lightbox-x-padding"
        onClick={onClose}
      >
        {/* Nav: previous */}
        {hasMultiple && hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            className="absolute left-4 z-10 size-12 rounded-full text-white hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="size-8" />
          </Button>
        )}

        {/* Media container */}
        <div
          className="h-full max-w-[calc(100vw-var(--spacing-lightbox-x-padding)*2)] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Loading spinner */}
          {isLoading && (
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          )}

          {/* Image */}
          {!isLoading && mediaUrl && current?.type === 'image' && (
            <img
              src={mediaUrl}
              alt={current.transferName || 'Image'}
              className="max-w-full max-h-full w-auto h-auto"
            />
          )}

          {/* Video */}
          {!isLoading && mediaUrl && current?.type === 'video' && (
            <video
              ref={videoRef}
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-full w-auto h-auto"
            />
          )}

          {/* Error state */}
          {!isLoading && !mediaUrl && (
            <div className="text-white text-center">
              <p className="text-lg">Unable to load media</p>
              <p className="text-sm text-white/60 mt-1">
                {current?.transferName || 'File not found'}
              </p>
            </div>
          )}
        </div>

        {/* Nav: next */}
        {hasMultiple && hasNext && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 z-10 size-12 rounded-full text-white hover:bg-white/20 hover:text-white"
          >
            <ChevronRight className="size-8" />
          </Button>
        )}
      </div>

      {/* Actions toolbar */}
      {showToolbar && current && (
        <div className="shrink-0 h-lightbox-toolbar flex items-center justify-center">
          <LightboxToolbar
            attachment={current}
            onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
            isInfoOpen={isInfoOpen}
          />
        </div>
      )}

      {/* Filmstrip */}
      {hasMultiple && (
        <div
          className="shrink-0 h-lightbox-filmstrip flex items-center gap-1.5 px-2 overflow-x-auto scrollbar-hide"
          onClick={(e) => e.stopPropagation()}
        >
          {attachments.map((attachment, index) => {
            const isMedia =
              attachment.type === 'image' || attachment.type === 'video';
            const thumbnailUrl =
              isMedia && !failedThumbnails.has(attachment.rowid)
                ? getThumbnailUrl(attachment.localPath)
                : null;
            const isActive = index === currentIndex;

            return (
              // {/* Thumbnail button */}
              <button
                key={attachment.rowid}
                ref={(el) => {
                  if (el) thumbnailRefs.current.set(attachment.rowid, el);
                }}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'relative shrink-0 size-lightbox-thumbnail rounded-lg overflow-hidden transition-all',
                  isActive
                    ? 'ring-2 ring-white opacity-100'
                    : 'opacity-50 hover:opacity-75'
                )}
              >
                {thumbnailUrl ? (
                  <>
                    {/* Thumbnail image */}
                    <img
                      src={thumbnailUrl}
                      className="w-full h-full object-cover"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => {
                        markUrlFailed(thumbnailUrl);
                        setFailedThumbnails((prev) =>
                          new Set(prev).add(attachment.rowid)
                        );
                      }}
                    />
                    {/* Video badge */}
                    {attachment.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="size-4 text-white drop-shadow" />
                      </div>
                    )}
                  </>
                ) : (
                  // {/* Fallback placeholder */}
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <Play className="size-4 text-white/50" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Info sheet */}
      <AttachmentInfoSheet
        attachment={current}
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </div>
  );
});
