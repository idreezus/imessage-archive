import { memo, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TimelineTick } from '@/types/timeline';
import { TimelineTickItem } from './timeline-tick';
import { useDockMagnification } from './use-dock-magnification';

type TimelineScrubberProps = {
  ticks: TimelineTick[];
  visibleMonthKey: string | null;
  onTickClick: (tick: TimelineTick) => void;
  className?: string;
};

// Timeline scrubber with macOS Dock-style magnification effect (Google Photos style).
// Shows all months as dots, year labels at boundaries, full label on hover.
export const TimelineScrubber = memo(function TimelineScrubber({
  ticks,
  visibleMonthKey,
  onTickClick,
  className,
}: TimelineScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [mouseY, setMouseY] = useState<number | null>(null);

  // Calculate magnification scales for each tick
  const { tickScales, tickRefs } = useDockMagnification({
    containerRef,
    mouseY,
    tickCount: ticks.length,
    isActive: isHovered,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMouseY(e.clientY - rect.top);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMouseY(null);
  }, []);

  if (ticks.length === 0) return null;

  return (
    // Outer wrapper - invisible hover trigger zone on the right edge
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-12 z-40',
        'group',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Inner container - the actual visible scrubber */}
      <div
        ref={containerRef}
        className={cn(
          // Fill the height and distribute ticks evenly
          'absolute right-0 top-4 bottom-4',
          // Visual styling
          'flex flex-col items-end justify-between px-2',
          // Fade effect - triggered by group hover
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          // Background with gradient and blur
          'bg-gradient-to-l from-background/90 via-background/60 to-transparent',
          'backdrop-blur-sm',
          // Rounded left edge
          'rounded-l-lg'
        )}
        onMouseMove={handleMouseMove}
      >
        {ticks.map((tick, index) => (
          <TimelineTickItem
            key={tick.key}
            ref={(el) => {
              tickRefs.current[index] = el;
            }}
            tick={tick}
            scale={tickScales[index] ?? 1}
            isActive={visibleMonthKey === tick.key}
            onClick={() => onTickClick(tick)}
          />
        ))}
      </div>
    </div>
  );
});
