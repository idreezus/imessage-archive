import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';

type LightboxProps = {
  attachments: Attachment[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
};

export const Lightbox = memo(function Lightbox({
  attachments,
  initialIndex,
  isOpen,
  onClose,
}: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<number, string>>(
    new Map()
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

  // Pre-fetch all thumbnail URLs when lightbox opens
  useEffect(() => {
    if (!isOpen || attachments.length <= 1) return;

    attachments.forEach((attachment) => {
      if (attachment.localPath && !thumbnailUrls.has(attachment.rowid)) {
        window.electronAPI
          .getAttachmentFileUrl(attachment.localPath)
          .then((url) => {
            if (url) {
              setThumbnailUrls((prev) =>
                new Map(prev).set(attachment.rowid, url)
              );
            }
          });
      }
    });
  }, [isOpen, attachments, thumbnailUrls]);

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
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium">
          {currentIndex + 1} of {attachments.length}
        </div>
      )}

      {/* Previous button */}
      {hasMultiple && hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Next button */}
      {hasMultiple && hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Thumbnail filmstrip */}
      {hasMultiple && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 max-w-[80vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1.5 p-2 bg-black/60 backdrop-blur-sm rounded-xl overflow-x-auto scrollbar-hide">
            {attachments.map((attachment, index) => {
              const url = thumbnailUrls.get(attachment.rowid);
              const isActive = index === currentIndex;

              return (
                <button
                  key={attachment.rowid}
                  ref={(el) => {
                    if (el) thumbnailRefs.current.set(attachment.rowid, el);
                  }}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'relative shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all',
                    isActive
                      ? 'ring-2 ring-white opacity-100'
                      : 'opacity-50 hover:opacity-75'
                  )}
                >
                  {url ? (
                    attachment.type === 'video' ? (
                      <>
                        <video
                          src={url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={url}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-white/10 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Media content */}
      <div
        className={cn(
          'max-w-[90vw] flex items-center justify-center',
          hasMultiple ? 'max-h-[calc(90vh-6rem)]' : 'max-h-[90vh]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        )}

        {!isLoading && mediaUrl && current?.type === 'image' && (
          <img
            src={mediaUrl}
            alt={current.transferName || 'Image'}
            className={cn(
              'max-w-full object-contain',
              hasMultiple ? 'max-h-[calc(90vh-6rem)]' : 'max-h-[90vh]'
            )}
          />
        )}

        {!isLoading && mediaUrl && current?.type === 'video' && (
          <video
            ref={videoRef}
            src={mediaUrl}
            controls
            autoPlay
            className={cn(
              'max-w-full',
              hasMultiple ? 'max-h-[calc(90vh-6rem)]' : 'max-h-[90vh]'
            )}
            onError={(e) => {
              const video = e.currentTarget;
              console.error('[Lightbox] Video error:', {
                error: video.error,
                code: video.error?.code,
                message: video.error?.message,
                src: video.src,
                networkState: video.networkState,
                readyState: video.readyState,
              });
            }}
            onLoadedMetadata={() => console.log('[Lightbox] Video metadata loaded:', mediaUrl)}
          />
        )}

        {!isLoading && !mediaUrl && (
          <div className="text-white text-center">
            <p className="text-lg">Unable to load media</p>
            <p className="text-sm text-white/60 mt-1">
              {current?.transferName || 'File not found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
