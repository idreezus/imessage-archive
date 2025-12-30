import { memo, useState, useEffect } from 'react';
import { Play, Music, FileText, File } from 'lucide-react';
import type { GalleryAttachment } from '@/types/gallery';
import { cn } from '@/lib/utils';

type GalleryThumbnailProps = {
  attachment: GalleryAttachment;
  onClick: () => void;
};

export const GalleryThumbnail = memo(function GalleryThumbnail({
  attachment,
  onClick,
}: GalleryThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!attachment.localPath) {
      setError(true);
      setIsLoading(false);
      return;
    }

    // Only load thumbnail for images and videos
    if (attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'sticker') {
      window.electronAPI
        .getAttachmentFileUrl(attachment.localPath)
        .then((url) => {
          if (url) {
            setThumbnailUrl(url);
          } else {
            setError(true);
          }
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [attachment.localPath, attachment.type]);

  // Render icon-based thumbnail for non-media types
  const renderIconThumbnail = () => {
    const iconClass = 'size-8 text-muted-foreground';
    let icon: React.ReactNode;
    let label: string;

    switch (attachment.type) {
      case 'audio':
      case 'voice-memo':
        icon = <Music className={iconClass} />;
        label = 'Audio';
        break;
      case 'document':
        icon = <FileText className={iconClass} />;
        label = 'Document';
        break;
      default:
        icon = <File className={iconClass} />;
        label = 'File';
    }

    return (
      <div className="flex flex-col items-center justify-center gap-1 h-full bg-muted/50">
        {icon}
        <span className="text-xs text-muted-foreground truncate px-2 max-w-full">
          {attachment.transferName || label}
        </span>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <button
        onClick={onClick}
        className="w-full h-full rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="w-full h-full animate-pulse bg-muted" />
      </button>
    );
  }

  // Error or non-media type
  if (error || !thumbnailUrl) {
    return (
      <button
        onClick={onClick}
        className="w-full h-full rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:opacity-80 transition-opacity"
      >
        {renderIconThumbnail()}
      </button>
    );
  }

  // Image/video thumbnail
  return (
    <button
      onClick={onClick}
      className="relative w-full h-full rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:opacity-90 transition-opacity"
    >
      {attachment.type === 'video' ? (
        <>
          <video
            src={thumbnailUrl}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="size-5 text-white ml-0.5" fill="white" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={thumbnailUrl}
          alt={attachment.transferName || 'Image'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Direction indicator */}
      <div
        className={cn(
          'absolute bottom-1 right-1 w-2 h-2 rounded-full',
          attachment.isFromMe ? 'bg-primary' : 'bg-muted-foreground'
        )}
        title={attachment.isFromMe ? 'Sent' : 'Received'}
      />
    </button>
  );
});
