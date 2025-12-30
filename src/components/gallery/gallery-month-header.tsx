import { memo } from 'react';

type GalleryMonthHeaderProps = {
  label: string;
};

export const GalleryMonthHeader = memo(function GalleryMonthHeader({
  label,
}: GalleryMonthHeaderProps) {
  return (
    <div className="col-span-full px-2 py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
});
