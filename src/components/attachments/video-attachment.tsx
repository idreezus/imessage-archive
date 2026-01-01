import { memo, useState, useCallback, useMemo } from 'react';
import { Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getPreviewUrl, markUrlFailed } from '@/lib/attachment-url';
import { calculateDisplayDimensions } from '@/lib/media-utils';
import { UnavailableAttachment } from './unavailable-attachment';
import { AttachmentContextMenu } from './attachment-context-menu';

type VideoAttachmentProps = {
  attachment: Attachment;
  dimensions?: { width: number; height: number };
  onOpenLightbox?: () => void;
  maxWidth?: number;
  maxHeight?: number;
};

const MAX_WIDTH = 480;
const MAX_HEIGHT = 600;

export const VideoAttachment = memo(function VideoAttachment({
  attachment,
  dimensions,
  onOpenLightbox,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
}: VideoAttachmentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Use preview-size thumbnail instead of loading full video
  // Video only plays when opened in lightbox
  const thumbnailUrl = getPreviewUrl(attachment.localPath);

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
    // Fallback placeholder dimensions (16:9 aspect ratio)
    return {
      width: Math.min(maxWidth * 0.6, maxWidth),
      height: Math.min(maxWidth * 0.6 * (9/16), maxHeight),
    };
  }, [dimensions, maxWidth, maxHeight]);

  const handleLoad = useCallback(() => {
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

  return (
    <AttachmentContextMenu attachment={attachment}>
      <button
        onClick={onOpenLightbox}
        className={cn(
          'relative block bg-black rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          onOpenLightbox && 'cursor-pointer hover:opacity-90 transition-opacity'
        )}
        style={{ width: containerDimensions.width, height: containerDimensions.height }}
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
