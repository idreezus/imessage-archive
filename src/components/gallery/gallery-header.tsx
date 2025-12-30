import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { GalleryStats } from '@/types/gallery';

type GalleryHeaderProps = {
  stats: GalleryStats | null;
  isLoading: boolean;
  chatDisplayName: string | null;
  onClose: () => void;
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
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : stats ? (
              formatStats(stats)
            ) : (
              'Loading...'
            )}
          </p>
        </div>
      </div>
    </div>
  );
});
