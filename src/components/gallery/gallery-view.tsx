import { memo, useCallback, useMemo, useRef } from 'react';
import {
  VirtuosoGrid,
  type VirtuosoGridHandle,
  type ListRange,
  type ScrollSeekConfiguration,
} from 'react-virtuoso';
import { useRenderTiming, log } from '@/lib/perf';
import { useGalleryContext } from './gallery-context';
import { GalleryHeader } from './gallery-header';
import { GalleryThumbnail } from './gallery-thumbnail';
import { GalleryEmpty } from './gallery-empty';
import { Lightbox } from '@/components/lightbox';
import { TimelineScrubber } from '@/components/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateIndex } from '@/hooks/use-date-index';
import { useVisibleDateRange } from '@/hooks/use-visible-date-range';
import type { GalleryAttachment } from '@/types/gallery';
import type { TimelineTick } from '@/types/timeline';

// Context type for VirtuosoGrid - passed to itemContent and custom components
type GalleryGridContext = {
  attachments: GalleryAttachment[];
  hasMore: boolean;
  onThumbnailClick: (index: number) => void;
};

// Loading skeleton grid - uses same CSS classes as VirtuosoGrid for consistency
function LoadingSkeleton() {
  return (
    <div className="gallery-grid">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="gallery-grid-item">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// Scroll seek placeholder component - shown during fast scrolling
const ScrollSeekPlaceholder = memo(function ScrollSeekPlaceholder() {
  return <Skeleton className="w-full h-full rounded-lg" />;
});

// Footer component - extracted to avoid inline function anti-pattern
const GalleryFooter = memo(function GalleryFooter({
  context,
}: {
  context?: GalleryGridContext;
}) {
  if (!context?.hasMore) return null;
  return (
    <div className="col-span-full flex justify-center py-4">
      <Skeleton className="h-4 w-24" />
    </div>
  );
});

// Scroll seek configuration - show placeholders during fast scrolling
const scrollSeekConfig: ScrollSeekConfiguration = {
  enter: (velocity) => Math.abs(velocity) > 500,
  exit: (velocity) => Math.abs(velocity) < 100,
};

type GalleryViewProps = {
  onFindInChat?: (chatId: number, messageId: number) => void;
};

export const GalleryView = memo(function GalleryView({
  onFindInChat,
}: GalleryViewProps) {
  const {
    attachments,
    stats,
    isLoading,
    hasMore,
    hasMoreBefore,
    loadMore,
    loadEarlier,
    navigateToDate,
    chatId,
    chatDisplayName,
    closeGallery,
    isFiltered,
    lightboxOpen,
    lightboxIndex,
    openLightbox,
    closeLightbox,
  } = useGalleryContext();

  // VirtuosoGrid ref for programmatic scrolling
  const virtuosoGridRef = useRef<VirtuosoGridHandle>(null);

  const isGlobalView = chatId === null;

  // Track render performance
  useRenderTiming('GalleryView', {
    attachmentCount: attachments.length,
    isGlobalView,
  });

  // Timeline scrubber hooks (only for chat-scoped view)
  const { ticks } = useDateIndex({
    chatId: chatId ?? null,
    source: 'gallery',
  });

  const { visibleMonthKey, handleRangeChanged: handleVisibleRangeChanged } =
    useVisibleDateRange({
      items: attachments,
      source: 'gallery',
    });

  // Handle timeline tick click - navigate to date using API
  const handleTimelineTickClick = useCallback(
    async (tick: TimelineTick) => {
      const targetIndex = await navigateToDate(tick.date);
      if (targetIndex !== undefined && virtuosoGridRef.current) {
        virtuosoGridRef.current.scrollToIndex({
          index: targetIndex,
          align: 'start',
        });
      }
    },
    [navigateToDate]
  );

  // Convert attachments to lightbox format
  const lightboxAttachments = useMemo(() => {
    return attachments
      .filter((a) => a.type === 'image' || a.type === 'video')
      .map((a) => ({
        rowid: a.rowid,
        guid: a.guid,
        filename: a.filename,
        mimeType: a.mimeType,
        uti: a.uti,
        transferName: a.transferName,
        totalBytes: a.totalBytes,
        isSticker: a.type === 'sticker',
        isAudioMessage: a.type === 'voice-memo',
        localPath: a.localPath,
        type: a.type,
      }));
  }, [attachments]);

  // Handle thumbnail click
  const handleThumbnailClick = useCallback(
    (index: number) => {
      const attachment = attachments[index];
      if (!attachment) return;

      // Find index in media-only array for lightbox
      const mediaIndex = lightboxAttachments.findIndex(
        (a) => a.rowid === attachment.rowid
      );

      if (mediaIndex !== -1) {
        openLightbox(mediaIndex);
      }
    },
    [attachments, lightboxAttachments, openLightbox]
  );

  // Handle load more (scroll down)
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Handle load earlier (scroll up) - bidirectional scrolling
  const handleStartReached = useCallback(() => {
    if (hasMoreBefore && !isLoading) {
      loadEarlier();
    }
  }, [hasMoreBefore, isLoading, loadEarlier]);

  // Track scroll range changes for performance analysis and timeline scrubber
  const lastRangeRef = useRef<ListRange | null>(null);
  const rangeChangeCountRef = useRef(0);
  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      rangeChangeCountRef.current++;
      const itemsInRange = range.endIndex - range.startIndex;
      // Log every 10 range changes to track scroll activity
      if (rangeChangeCountRef.current % 10 === 0) {
        log('render', 'gallery.scrollRange', 0, {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
          itemsVisible: itemsInRange,
          totalItems: attachments.length,
          rangeChanges: rangeChangeCountRef.current,
        });
      }
      lastRangeRef.current = range;

      // Update timeline scrubber visible range
      handleVisibleRangeChanged(range);
    },
    [attachments.length, handleVisibleRangeChanged]
  );

  // Render grid item
  const renderItem = useCallback(
    (index: number) => {
      const attachment = attachments[index];
      if (!attachment) return null;

      return (
        <GalleryThumbnail
          attachment={attachment}
          onClick={() => handleThumbnailClick(index)}
          onFindInChat={onFindInChat}
        />
      );
    },
    [attachments, handleThumbnailClick, onFindInChat]
  );

  // Initial loading state
  if (isLoading && attachments.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <GalleryHeader
          stats={null}
          isLoading={true}
          chatDisplayName={chatDisplayName}
          onClose={closeGallery}
        />
        <LoadingSkeleton />
      </div>
    );
  }

  // Empty state
  if (!isLoading && attachments.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <GalleryHeader
          stats={stats}
          isLoading={isLoading}
          chatDisplayName={chatDisplayName}
          onClose={closeGallery}
        />
        <div className="flex-1 flex items-center justify-center">
          <GalleryEmpty isFiltered={isFiltered} isGlobalView={isGlobalView} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <GalleryHeader
        stats={stats}
        isLoading={isLoading}
        chatDisplayName={chatDisplayName}
        onClose={closeGallery}
      />

      {/* Grid */}
      <div className="flex-1 overflow-hidden relative">
        <VirtuosoGrid
          ref={virtuosoGridRef}
          totalCount={attachments.length}
          itemContent={renderItem}
          listClassName="gallery-grid"
          itemClassName="gallery-grid-item"
          overscan={12}
          startReached={handleStartReached}
          endReached={handleEndReached}
          rangeChanged={handleRangeChanged}
          scrollSeekConfiguration={scrollSeekConfig}
          style={{ height: '100%' }}
          context={{ attachments, hasMore, onThumbnailClick: handleThumbnailClick }}
          computeItemKey={(index, _data, ctx) => {
            const attachment = ctx.attachments[index];
            return attachment ? `att-${attachment.rowid}` : `att-${index}`;
          }}
          components={{
            ScrollSeekPlaceholder,
            Footer: GalleryFooter,
          }}
        />

        {/* Timeline scrubber for date navigation (chat-scoped view only) */}
        {chatId !== null && ticks.length > 0 && (
          <TimelineScrubber
            ticks={ticks}
            visibleMonthKey={visibleMonthKey}
            onTickClick={handleTimelineTickClick}
          />
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        attachments={lightboxAttachments}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        showToolbar
      />
    </div>
  );
});
