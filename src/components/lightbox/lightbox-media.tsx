import { memo, type RefObject } from 'react';
import type { Attachment } from '@/types';

type LightboxMediaProps = {
  attachment: Attachment | undefined;
  mediaUrl: string | null;
  isLoading: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export const LightboxMedia = memo(function LightboxMedia({
  attachment,
  mediaUrl,
  isLoading,
  videoRef,
}: LightboxMediaProps) {
  return (
    <div
      className="h-full max-w-[calc(100vw-var(--spacing-lightbox-x-padding)*2)] flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {isLoading && (
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      )}

      {!isLoading && mediaUrl && attachment?.type === 'image' && (
        <img
          src={mediaUrl}
          alt={attachment.transferName || 'Image'}
          className="max-w-full max-h-full w-auto h-auto"
        />
      )}

      {!isLoading && mediaUrl && attachment?.type === 'video' && (
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          autoPlay
          className="max-w-full max-h-full w-auto h-auto"
        />
      )}

      {!isLoading && !mediaUrl && (
        <div className="text-white text-center">
          <p className="text-lg">Unable to load media</p>
          <p className="text-sm text-white/60 mt-1">
            {attachment?.transferName || 'File not found'}
          </p>
        </div>
      )}
    </div>
  );
});
