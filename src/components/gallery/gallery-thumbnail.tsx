import { memo, useState, useCallback, useMemo } from 'react';
import { Play, Music, FileText, File } from 'lucide-react';
import type { GalleryAttachment } from '@/types/gallery';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getThumbnailUrl, markUrlFailed } from '@/lib/attachment-url';
import { AttachmentContextMenu } from '@/components/attachments/attachment-context-menu';

type GalleryThumbnailProps = {
  attachment: GalleryAttachment;
  onClick: () => void;
};

export const GalleryThumbnail = memo(function GalleryThumbnail({
  attachment,
  onClick,
}: GalleryThumbnailProps) {
  const [error, setError] = useState(false);

  // Convert GalleryAttachment to Attachment for context menu compatibility
  const contextMenuAttachment: Attachment = useMemo(
    () => ({
      rowid: attachment.rowid,
      guid: attachment.guid,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      uti: attachment.uti,
      transferName: attachment.transferName,
      totalBytes: attachment.totalBytes,
      localPath: attachment.localPath,
      type: attachment.type,
      isSticker: attachment.type === 'sticker',
      isAudioMessage: attachment.type === 'voice-memo',
    }),
    [attachment]
  );

  // Construct URL synchronously - no async, no IPC, no useEffect
  const isMedia =
    attachment.type === 'image' ||
    attachment.type === 'video' ||
    attachment.type === 'sticker';

  const thumbnailUrl = isMedia ? getThumbnailUrl(attachment.localPath) : null;

  // Handle image load error (file doesn't exist)
  // Mark URL as failed so we don't retry on component recycle
  const handleError = useCallback(() => {
    if (thumbnailUrl) {
      markUrlFailed(thumbnailUrl);
    }
    setError(true);
  }, [thumbnailUrl]);

  // Render icon-based thumbnail for non-media types
  const renderIconThumbnail = useCallback(() => {
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
  }, [attachment.type, attachment.transferName]);

  // Error or non-media type - show icon
  if (error || !thumbnailUrl) {
    return (
      <AttachmentContextMenu attachment={contextMenuAttachment}>
        <button
          onClick={onClick}
          className="w-full h-full rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:opacity-80 transition-opacity"
        >
          {renderIconThumbnail()}
        </button>
      </AttachmentContextMenu>
    );
  }

  // Image/video thumbnail
  return (
    <AttachmentContextMenu attachment={contextMenuAttachment}>
      <button
        onClick={onClick}
        className="relative w-full h-full rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:opacity-90 transition-opacity"
      >
        <img
          src={thumbnailUrl}
          alt={attachment.transferName || 'Media'}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={handleError}
        />

        {/* Video play icon overlay */}
        {attachment.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="size-5 text-white ml-0.5" fill="white" />
            </div>
          </div>
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
    </AttachmentContextMenu>
  );
});
