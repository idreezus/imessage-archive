import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GalleryFiltersPopover } from './gallery-filters-popover';
import type {
  GalleryStats,
  GalleryFilters,
  GallerySortBy,
  GallerySortOrder,
  GalleryDatePreset,
} from '@/types/gallery';
import type { AttachmentType } from '@/types';

type GalleryHeaderProps = {
  stats: GalleryStats | null;
  isLoading: boolean;
  chatDisplayName: string | null;
  onClose: () => void;
  // Filter props to pass through to GalleryFiltersPopover
  filters: GalleryFilters;
  isFiltered: boolean;
  sortBy: GallerySortBy;
  sortOrder: GallerySortOrder;
  onTypeFilter: (types: AttachmentType[] | 'all') => void;
  onDirection: (direction: 'all' | 'sent' | 'received') => void;
  onDateRange: (
    range:
      | { from: Date | null; to: Date | null; preset: GalleryDatePreset | null }
      | GalleryDatePreset
  ) => void;
  onSortBy: (sort: GallerySortBy) => void;
  onToggleSortOrder: () => void;
};

function formatStats(stats: GalleryStats): string {
  const parts: string[] = [];
  if (stats.photos > 0) parts.push(`${stats.photos.toLocaleString()} photos`);
  if (stats.videos > 0) parts.push(`${stats.videos.toLocaleString()} videos`);
  if (stats.audio > 0) parts.push(`${stats.audio.toLocaleString()} audio`);
  if (stats.files > 0) parts.push(`${stats.files.toLocaleString()} files`);
  return parts.length > 0 ? parts.join(' \u00B7 ') : 'No attachments';
}

export const GalleryHeader = memo(function GalleryHeader({
  stats,
  isLoading,
  chatDisplayName,
  onClose,
  filters,
  isFiltered,
  sortBy,
  sortOrder,
  onTypeFilter,
  onDirection,
  onDateRange,
  onSortBy,
  onToggleSortOrder,
}: GalleryHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b bg-background px-4 py-3 shrink-0">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close gallery"
        >
          <ArrowLeft className="size-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">
            {chatDisplayName ? `${chatDisplayName} Media` : 'All Media'}
          </h2>
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : stats ? (
              formatStats(stats)
            ) : (
              'Loading...'
            )}
          </div>
        </div>

        <GalleryFiltersPopover
          filters={filters}
          sortBy={sortBy}
          sortOrder={sortOrder}
          isFiltered={isFiltered}
          onTypeFilter={onTypeFilter}
          onDirection={onDirection}
          onDateRange={onDateRange}
          onSortBy={onSortBy}
          onToggleSortOrder={onToggleSortOrder}
        />
      </div>
    </div>
  );
});
