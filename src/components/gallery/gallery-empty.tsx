import { memo } from 'react';
import { Images, Filter } from 'lucide-react';
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';

type GalleryEmptyProps = {
  isFiltered: boolean;
  isGlobalView: boolean;
};

export const GalleryEmpty = memo(function GalleryEmpty({
  isFiltered,
  isGlobalView,
}: GalleryEmptyProps) {
  if (isFiltered) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Filter className="size-6" />
        </EmptyMedia>
        <EmptyTitle>No matching attachments</EmptyTitle>
        <EmptyDescription>
          Try adjusting your filters to see more results
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyMedia variant="icon">
        <Images className="size-6" />
      </EmptyMedia>
      <EmptyTitle>
        {isGlobalView ? 'No media in your archive' : 'No media in this conversation'}
      </EmptyTitle>
      <EmptyDescription>
        {isGlobalView
          ? 'Photos, videos, and files shared in your messages will appear here'
          : 'Photos, videos, and files shared in this conversation will appear here'}
      </EmptyDescription>
    </Empty>
  );
});
