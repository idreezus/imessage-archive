import { memo, useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { getThumbnailUrl, markUrlFailed } from '@/lib/attachment-url';

type LightboxFilmstripProps = {
  attachments: Attachment[];
  currentIndex: number;
  onSelect: (index: number) => void;
};

export const LightboxFilmstrip = memo(function LightboxFilmstrip({
  attachments,
  currentIndex,
  onSelect,
}: LightboxFilmstripProps) {
  const [failedThumbnails, setFailedThumbnails] = useState<Set<number>>(
    new Set()
  );
  const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Auto-scroll to keep current thumbnail visible
  useEffect(() => {
    const currentRef = thumbnailRefs.current.get(
      attachments[currentIndex]?.rowid
    );
    currentRef?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentIndex, attachments]);

  return (
    <div
      className="shrink-0 h-lightbox-filmstrip flex items-center gap-1.5 px-2 overflow-x-auto scrollbar-hide"
      onClick={(e) => e.stopPropagation()}
    >
      {attachments.map((attachment, index) => {
        const isMedia =
          attachment.type === 'image' || attachment.type === 'video';
        const thumbnailUrl =
          isMedia && !failedThumbnails.has(attachment.rowid)
            ? getThumbnailUrl(attachment.localPath)
            : null;
        const isActive = index === currentIndex;

        return (
          <button
            key={attachment.rowid}
            ref={(el) => {
              if (el) thumbnailRefs.current.set(attachment.rowid, el);
            }}
            onClick={() => onSelect(index)}
            className={cn(
              'relative shrink-0 size-lightbox-thumbnail rounded-lg overflow-hidden transition-all',
              isActive
                ? 'ring-2 ring-white opacity-100'
                : 'opacity-50 hover:opacity-75'
            )}
          >
            {thumbnailUrl ? (
              <>
                <img
                  src={thumbnailUrl}
                  className="w-full h-full object-cover"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => {
                    markUrlFailed(thumbnailUrl);
                    setFailedThumbnails((prev) =>
                      new Set(prev).add(attachment.rowid)
                    );
                  }}
                />
                {attachment.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="size-4 text-white drop-shadow" />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <Play className="size-4 text-white/50" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
});
