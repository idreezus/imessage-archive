import { memo } from 'react';
import type { Attachment } from '@/types';
import { AttachmentItem } from './attachment-item';
import { cn } from '@/lib/utils';
import { useAttachmentDimensions } from '@/hooks/use-attachment-dimensions';

type AttachmentGridProps = {
  attachments: Attachment[];
  onOpenLightbox: (index: number) => void;
};

export const AttachmentGrid = memo(function AttachmentGrid({
  attachments,
  onOpenLightbox,
}: AttachmentGridProps) {
  // Prefetch dimensions for all attachments to prevent layout shift
  const dimensions = useAttachmentDimensions(attachments);
  const count = attachments.length;

  // Single attachment - render directly
  if (count === 1) {
    const attachment = attachments[0];
    const canOpenLightbox = attachment.type === 'image' || attachment.type === 'video';

    return (
      <AttachmentItem
        attachment={attachment}
        dimensions={attachment.localPath ? dimensions[attachment.localPath] : undefined}
        onOpenLightbox={canOpenLightbox ? () => onOpenLightbox(0) : undefined}
      />
    );
  }

  // Check if all attachments are images/videos (for stacked layout)
  const allVisual = attachments.every(
    (a) => a.type === 'image' || a.type === 'video'
  );

  // Multiple images/videos - stacked card layout
  if (allVisual) {
    const visibleAttachments = attachments.slice(0, 4);

    return (
      <div className="relative cursor-pointer" onClick={() => onOpenLightbox(0)}>
        {/* Background stacked cards */}
        {visibleAttachments.slice(1).reverse().map((_, reverseIndex) => {
          const stackIndex = visibleAttachments.length - 1 - reverseIndex;
          const offset = stackIndex * 6;
          const scale = 1 - stackIndex * 0.03;

          return (
            <div
              key={`stack-${stackIndex}`}
              className="absolute bg-muted/80 rounded-2xl border border-border/50"
              style={{
                top: offset,
                left: offset / 2,
                right: -offset / 2,
                bottom: -offset,
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                zIndex: visibleAttachments.length - stackIndex,
              }}
            />
          );
        })}

        {/* Top image */}
        <div className="relative z-10">
          <AttachmentItem
            attachment={visibleAttachments[0]}
            dimensions={visibleAttachments[0].localPath ? dimensions[visibleAttachments[0].localPath] : undefined}
            onOpenLightbox={() => onOpenLightbox(0)}
          />
        </div>

        {/* Count badge */}
        {count > 1 && (
          <div className="absolute bottom-2 right-2 z-20 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-full">
            {count} photos
          </div>
        )}
      </div>
    );
  }

  // Mixed content - grid layout
  const gridClass = cn(
    'grid gap-1',
    count === 2 && 'grid-cols-2',
    count >= 3 && 'grid-cols-2'
  );

  // Only show first 4 in grid
  const visibleAttachments = attachments.slice(0, 4);
  const remainingCount = count - 4;

  return (
    <div className={cn('relative', gridClass)}>
      {visibleAttachments.map((attachment, index) => {
        const canOpenLightbox = attachment.type === 'image' || attachment.type === 'video';
        const isLastVisible = index === 3 && remainingCount > 0;

        return (
          <div key={attachment.rowid} className="relative">
            <AttachmentItem
              attachment={attachment}
              dimensions={attachment.localPath ? dimensions[attachment.localPath] : undefined}
              onOpenLightbox={canOpenLightbox ? () => onOpenLightbox(index) : undefined}
            />
            {isLastVisible && (
              <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                <span className="text-white text-lg font-medium">
                  +{remainingCount}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
