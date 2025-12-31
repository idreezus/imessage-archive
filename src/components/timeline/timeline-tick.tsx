import { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';
import type { TimelineTick } from '@/types/timeline';

type TimelineTickProps = {
  tick: TimelineTick;
  scale: number;
  isActive: boolean;
  onClick: () => void;
};

// Individual timeline tick with magnification transform (Google Photos style).
// Shows year labels at boundaries, dots for months, full label on hover.
export const TimelineTickItem = memo(
  forwardRef<HTMLButtonElement, TimelineTickProps>(function TimelineTickItem(
    { tick, scale, isActive, onClick },
    ref
  ) {
    // Show full label when hovered/magnified (scale > 1.2) or when it's a year boundary
    const showLabel = scale > 1.2 || tick.isYearStart;
    // Only show year label at year boundaries when not magnified
    const labelText = scale > 1.2 ? tick.label : tick.yearLabel;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 py-0.5 pr-2 cursor-pointer',
          'transition-all duration-100 ease-out',
          'hover:bg-accent/50 rounded-l-full',
          'origin-right'
        )}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'right center',
        }}
      >
        {/* Label - shown at year boundaries or when magnified */}
        {showLabel && labelText && (
          <span
            className={cn(
              'text-right whitespace-nowrap select-none text-[11px]',
              isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {labelText}
          </span>
        )}

        {/* Dot/tick mark */}
        <div
          className={cn(
            'rounded-full flex-shrink-0 transition-all duration-100',
            isActive ? 'bg-primary' : 'bg-muted-foreground/40',
            tick.isYearStart && !isActive && 'bg-foreground/60'
          )}
          style={{
            width: tick.isYearStart ? 6 : 4,
            height: tick.isYearStart ? 6 : 4,
          }}
        />
      </button>
    );
  })
);
