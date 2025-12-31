import { memo, useState, useCallback, useMemo } from 'react';
import { Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getPreviewUrl, markUrlFailed } from '@/lib/attachment-url';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type VideoAttachmentProps = {
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

export const VideoAttachment = memo(function VideoAttachment({
  attachment,
  onOpenLightbox,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
}: VideoAttachmentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  // Use preview-size thumbnail instead of loading full video
  // Video only plays when opened in lightbox
  const thumbnailUrl = getPreviewUrl(attachment.localPath);

  // Calculate placeholder dimensions - use a reasonable default aspect ratio (16:9)
  const placeholderDimensions = useMemo(() => ({
    width: Math.min(maxWidth * 0.6, maxWidth),
    height: Math.min(maxWidth * 0.6 * (9/16), maxHeight),
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

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    if (thumbnailUrl) {
      markUrlFailed(thumbnailUrl);
    }
    setError(true);
    setIsLoading(false);
  }, [thumbnailUrl]);

  if (error || !thumbnailUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  // Use display dimensions if available, otherwise use placeholder dimensions
  const containerStyle = displayDimensions
    ? { width: displayDimensions.width, height: displayDimensions.height }
    : placeholderDimensions;

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={onOpenLightbox}
        className={cn(
          'relative block bg-black rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          onOpenLightbox && 'cursor-pointer hover:opacity-90 transition-opacity'
        )}
        style={containerStyle}
        disabled={!onOpenLightbox}
      >
        {isLoading && (
          <div className="absolute inset-0 animate-pulse bg-muted rounded-2xl" />
        )}
        <img
          src={thumbnailUrl}
          alt={attachment.transferName || 'Video'}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-200',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-6 h-6 text-black ml-1" />
          </div>
        </div>
      </button>
    </AttachmentContextMenu>
  );
});
