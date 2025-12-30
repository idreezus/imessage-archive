import { memo, useState, useEffect, useCallback } from 'react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { UnavailableAttachment } from './unavailable-attachment';

type ImageAttachmentProps = {
  attachment: Attachment;
  onOpenLightbox?: () => void;
  maxWidth?: number;
  maxHeight?: number;
};

const MAX_WIDTH = 480;
const MAX_HEIGHT = 600;

export const ImageAttachment = memo(function ImageAttachment({
  attachment,
  onOpenLightbox,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
}: ImageAttachmentProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

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
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Calculate scaled dimensions that respect aspect ratio
    const aspectRatio = naturalWidth / naturalHeight;
    let width = naturalWidth;
    let height = naturalHeight;

    // Scale down if exceeds max width
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    // Scale down further if exceeds max height
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    setDimensions({ width, height });
    setIsLoading(false);
  }, [maxWidth, maxHeight]);

  if (error) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  // Show placeholder while fetching URL
  if (!imageUrl) {
    return (
      <div
        className="animate-pulse bg-muted rounded-2xl"
        style={{ width: maxWidth * 0.6, height: maxWidth * 0.8 }}
      />
    );
  }

  return (
    <button
      onClick={onOpenLightbox}
      className={cn(
        'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl overflow-hidden',
        onOpenLightbox && 'cursor-pointer hover:opacity-90 transition-opacity'
      )}
      disabled={!onOpenLightbox}
    >
      {isLoading && (
        <div
          className="animate-pulse bg-muted rounded-2xl"
          style={{ width: maxWidth * 0.6, height: maxWidth * 0.8 }}
        />
      )}
      <img
        src={imageUrl}
        alt={attachment.transferName || 'Image'}
        className={cn(
          'rounded-2xl transition-opacity duration-200',
          isLoading ? 'absolute opacity-0' : 'opacity-100'
        )}
        style={dimensions ? { width: dimensions.width, height: dimensions.height } : { maxWidth, maxHeight }}
        onLoad={handleImageLoad}
        onError={() => setError(true)}
      />
    </button>
  );
});
