import { memo, useState, useCallback, useMemo } from 'react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getPreviewUrl, markUrlFailed } from '@/lib/attachment-url';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type ImageAttachmentProps = {
  attachment: Attachment;
  dimensions?: { width: number; height: number };
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
  dimensions,
  onOpenLightbox,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
}: ImageAttachmentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Use preview-size (720px) for message view - much smaller than full resolution
  // Full resolution only loads when opening lightbox
  const imageUrl = getPreviewUrl(attachment.localPath);

  // Calculate container dimensions from pre-fetched dimensions or fallback to placeholder
  const containerDimensions = useMemo(() => {
    if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
      return calculateDisplayDimensions(
        dimensions.width,
        dimensions.height,
        maxWidth,
        maxHeight
      );
    }
    // Fallback placeholder dimensions
    return {
      width: Math.min(maxWidth * 0.6, maxWidth),
      height: Math.min(maxWidth * 0.8, maxHeight),
    };
  }, [dimensions, maxWidth, maxHeight]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    if (imageUrl) {
      markUrlFailed(imageUrl);
    }
    setError(true);
    setIsLoading(false);
  }, [imageUrl]);

  if (error || !imageUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={onOpenLightbox}
        className={cn(
          'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl overflow-hidden',
          onOpenLightbox && 'cursor-pointer hover:opacity-90 transition-opacity'
        )}
        style={{ width: containerDimensions.width, height: containerDimensions.height }}
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
            'w-full h-full object-cover rounded-2xl transition-opacity duration-200',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleImageLoad}
          onError={handleError}
        />
      </button>
    </AttachmentContextMenu>
  );
});
