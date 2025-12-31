import { memo, useCallback, useMemo, useRef } from 'react';
import { VirtuosoGrid, type ListRange, type ScrollSeekConfiguration } from 'react-virtuoso';
import { useRenderTiming, measureSync, log } from '@/lib/perf';
import { useGalleryContext } from './gallery-context';
import { GalleryHeader } from './gallery-header';
import { GalleryThumbnail } from './gallery-thumbnail';
import { GalleryMonthHeader } from './gallery-month-header';
import { GalleryEmpty } from './gallery-empty';
import { Lightbox } from '@/components/lightbox';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  GalleryAttachment,
  GalleryGridItem,
  MonthGroup,
} from '@/types/gallery';

// Format month key to display label
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Group attachments by month for chat-scoped view
function groupByMonth(attachments: GalleryAttachment[]): MonthGroup[] {
  const groups = new Map<string, GalleryAttachment[]>();

  for (const attachment of attachments) {
    const existing = groups.get(attachment.monthKey) || [];
    existing.push(attachment);
    groups.set(attachment.monthKey, existing);
  }

  let startIndex = 0;
  return Array.from(groups.entries()).map(([key, items]) => {
    const group: MonthGroup = {
      monthKey: key,
      label: formatMonthLabel(key),
      attachments: items,
      startIndex,
    };
    startIndex += items.length + 1; // +1 for header
    return group;
  });
}

// Flatten groups to grid items (headers + attachments)
function flattenToGridItems(
  attachments: GalleryAttachment[],
  showMonthHeaders: boolean
): GalleryGridItem[] {
  if (!showMonthHeaders) {
    return attachments.map((data) => ({ type: 'attachment', data }));
  }

  const groups = groupByMonth(attachments);
  const items: GalleryGridItem[] = [];

  for (const group of groups) {
    items.push({
      type: 'header',
      monthKey: group.monthKey,
      label: group.label,
    });
    for (const attachment of group.attachments) {
      items.push({ type: 'attachment', data: attachment });
    }
  }

  return items;
}

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
  return (
    <div className="w-full h-full rounded-lg bg-muted/50 animate-pulse" />
  );
});

// Scroll seek configuration - show placeholders during fast scrolling
const scrollSeekConfig: ScrollSeekConfiguration = {
  enter: (velocity) => Math.abs(velocity) > 500,
  exit: (velocity) => Math.abs(velocity) < 100,
};

export const GalleryView = memo(function GalleryView() {
  const {
    attachments,
    stats,
    isLoading,
    hasMore,
    loadMore,
    chatId,
    chatDisplayName,
    closeGallery,
    isFiltered,
    lightboxOpen,
    lightboxIndex,
    openLightbox,
    closeLightbox,
  } = useGalleryContext();

  // Show month headers for chat-scoped view
  const showMonthHeaders = chatId !== null;
  const isGlobalView = chatId === null;

  // Flatten attachments to grid items
  const gridItems = useMemo(
    () =>
      measureSync('gallery.flattenToGridItems', () =>
        flattenToGridItems(attachments, showMonthHeaders)
      ),
    [attachments, showMonthHeaders]
  );

  // Track render performance
  useRenderTiming('GalleryView', {
    attachmentCount: attachments.length,
    gridItemCount: gridItems.length,
    isGlobalView,
  });

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
    (gridIndex: number) => {
      const item = gridItems[gridIndex];
      if (item.type !== 'attachment') return;

      // Find index in media-only array for lightbox
      const mediaIndex = lightboxAttachments.findIndex(
        (a) => a.rowid === item.data.rowid
      );

      if (mediaIndex !== -1) {
        openLightbox(mediaIndex);
      }
    },
    [gridItems, lightboxAttachments, openLightbox]
  );

  // Handle load more
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Track scroll range changes for performance analysis
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
          totalItems: gridItems.length,
          rangeChanges: rangeChangeCountRef.current,
        });
      }
      lastRangeRef.current = range;
    },
    [gridItems.length]
  );

  // Render grid item
  const renderItem = useCallback(
    (index: number) => {
      const item = gridItems[index];

      if (item.type === 'header') {
        return <GalleryMonthHeader label={item.label} />;
      }

      return (
        <GalleryThumbnail
          attachment={item.data}
          onClick={() => handleThumbnailClick(index)}
        />
      );
    },
    [gridItems, handleThumbnailClick]
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
      <div className="flex-1 overflow-hidden">
        <VirtuosoGrid
          totalCount={gridItems.length}
          itemContent={renderItem}
          listClassName="gallery-grid"
          itemClassName="gallery-grid-item"
          overscan={12}
          endReached={handleEndReached}
          rangeChanged={handleRangeChanged}
          scrollSeekConfiguration={scrollSeekConfig}
          style={{ height: '100%' }}
          components={{
            ScrollSeekPlaceholder,
            Footer: () =>
              hasMore ? (
                <div className="col-span-full flex justify-center py-4">
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : null,
          }}
        />
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
