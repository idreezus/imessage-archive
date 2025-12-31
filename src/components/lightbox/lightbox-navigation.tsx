import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LightboxNavigationProps = {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export const LightboxNavigation = memo(function LightboxNavigation({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: LightboxNavigationProps) {
  return (
    <>
      {hasPrev && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 z-10 size-12 rounded-full text-white hover:bg-white/20 hover:text-white"
        >
          <ChevronLeft className="size-8" />
        </Button>
      )}

      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 z-10 size-12 rounded-full text-white hover:bg-white/20 hover:text-white"
        >
          <ChevronRight className="size-8" />
        </Button>
      )}
    </>
  );
});
