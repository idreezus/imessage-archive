import { memo, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { UnavailableAttachment } from './unavailable-attachment';

type VideoAttachmentProps = {
  attachment: Attachment;
  onOpenLightbox?: () => void;
  maxWidth?: number;
  maxHeight?: number;
};

export const VideoAttachment = memo(function VideoAttachment({
  attachment,
  onOpenLightbox,
  maxWidth = 240,
  maxHeight = 180,
}: VideoAttachmentProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

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
          setVideoUrl(url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [attachment.localPath]);

  if (isLoading) {
    return (
      <div
        className="animate-pulse bg-muted rounded-lg"
        style={{ width: maxWidth, height: maxHeight }}
      />
    );
  }

  if (error || !videoUrl) {
    return <UnavailableAttachment attachment={attachment} />;
  }

  return (
    <button
      onClick={onOpenLightbox}
      className={cn(
        'relative block bg-muted rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        onOpenLightbox && 'cursor-pointer'
      )}
      style={{ width: maxWidth, height: maxHeight }}
      disabled={!onOpenLightbox}
    >
      <video
        src={videoUrl}
        className="w-full h-full object-cover"
        preload="metadata"
        onError={(e) => {
          const video = e.currentTarget;
          console.error('[VideoAttachment] Video error:', {
            error: video.error,
            code: video.error?.code,
            message: video.error?.message,
            src: video.src,
            networkState: video.networkState,
            readyState: video.readyState,
          });
        }}
        onLoadedMetadata={() => console.log('[VideoAttachment] Metadata loaded:', videoUrl)}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-6 h-6 text-black ml-1" />
        </div>
      </div>
    </button>
  );
});
