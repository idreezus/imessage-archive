import { memo, useState, useCallback, useMemo } from 'react';
import { Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getPreviewUrl, markUrlFailed } from '@/lib/attachment-url';
import { calculateDisplayDimensions } from '@/lib/media-utils';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type MediaAttachmentProps = {
  attachment: Attachment;
  dimensions?: { width: number; height: number };
  onOpenLightbox?: () => void;
  maxWidth?: number;
  maxHeight?: number;
};

const MAX_WIDTH = 480;
const MAX_HEIGHT = 600;

// Renders image or video media with preview thumbnail
export const MediaAttachment = memo(function MediaAttachment({
  attachment,
  dimensions,
  onOpenLightbox,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
}: MediaAttachmentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const isVideo = attachment.type === 'video';

  // Use preview-size (720px) for message view - much smaller than full resolution
  const previewUrl = getPreviewUrl(attachment.localPath);

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
    // Fallback placeholder dimensions: 4:5 for images, 16:9 for videos
    const fallbackAspect = isVideo ? 9 / 16 : 0.8;
    return {
      width: Math.min(maxWidth * 0.6, maxWidth),
      height: Math.min(maxWidth * 0.6 * fallbackAspect, maxHeight),
    };
  }, [dimensions, maxWidth, maxHeight, isVideo]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    if (previewUrl) {
      markUrlFailed(previewUrl);
    }
    setError(true);
    setIsLoading(false);
  }, [previewUrl]);

  if (error || !previewUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={onOpenLightbox}
        className={cn(
          'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl overflow-hidden',
          onOpenLightbox && 'cursor-pointer hover:opacity-90 transition-opacity',
          isVideo && 'bg-black'
        )}
        style={{ width: containerDimensions.width, height: containerDimensions.height }}
        disabled={!onOpenLightbox}
      >
        {isLoading && (
          <div className="absolute inset-0 animate-pulse bg-muted rounded-2xl" />
        )}
        <img
          src={previewUrl}
          alt={attachment.transferName || (isVideo ? 'Video' : 'Image')}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-200',
            !isVideo && 'rounded-2xl',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-6 h-6 text-black ml-1" />
            </div>
          </div>
        )}
      </button>
    </AttachmentContextMenu>
  );
});
