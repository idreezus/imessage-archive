import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type ImageAttachmentProps = {
  attachment: Attachment;
  onOpenLightbox?: () => void;
  maxWidth?: number;
  maxHeight?: number;
};

const MAX_WIDTH = 480;
const MAX_HEIGHT = 600;

// Calculate display dimensions while strictly maintaining aspect ratio
function calculateDisplayDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (naturalWidth === 0 || naturalHeight === 0) {
    return { width: maxWidth * 0.6, height: maxHeight * 0.6 };
  }

  const aspectRatio = naturalWidth / naturalHeight;
  let width = naturalWidth;
  let height = naturalHeight;

  // Scale down if exceeds max width (maintain aspect ratio)
  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  // Scale down further if still exceeds max height (maintain aspect ratio)
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height };
}

export const ImageAttachment = memo(function ImageAttachment({
  attachment,
  onOpenLightbox,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
}: ImageAttachmentProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  // Calculate placeholder dimensions - use a reasonable default aspect ratio
  const placeholderDimensions = useMemo(() => ({
    width: Math.min(maxWidth * 0.6, maxWidth),
    height: Math.min(maxWidth * 0.8, maxHeight),
  }), [maxWidth, maxHeight]);

  // Calculate display dimensions from natural dimensions
  const displayDimensions = useMemo(() => {
    if (!naturalDimensions) return null;
    return calculateDisplayDimensions(
      naturalDimensions.width,
      naturalDimensions.height,
      maxWidth,
      maxHeight
    );
  }, [naturalDimensions, maxWidth, maxHeight]);

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
          setIsLoading(false);
        }
      })
      .catch(() => {
        setError(true);
        setIsLoading(false);
      });
  }, [attachment.localPath]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setIsLoading(false);
  }, []);

  if (error) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  // Show placeholder while fetching URL
  if (!imageUrl) {
    return (
      <div
        className="animate-pulse bg-muted rounded-2xl"
        style={placeholderDimensions}
      />
    );
  }

  // Use display dimensions if available, otherwise constrain with maxWidth/maxHeight
  const containerStyle = displayDimensions
    ? { width: displayDimensions.width, height: displayDimensions.height }
    : placeholderDimensions;

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={onOpenLightbox}
        className={cn(
          'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl overflow-hidden',
          onOpenLightbox && 'cursor-pointer hover:opacity-90 transition-opacity'
        )}
        style={containerStyle}
        disabled={!onOpenLightbox}
      >
        {isLoading && (
          <div
            className="absolute inset-0 animate-pulse bg-muted rounded-2xl"
          />
        )}
        <img
          src={imageUrl}
          alt={attachment.transferName || 'Image'}
          className={cn(
            'w-full h-full object-contain rounded-2xl transition-opacity duration-200',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleImageLoad}
          onError={() => setError(true)}
        />
      </button>
    </AttachmentContextMenu>
  );
});
