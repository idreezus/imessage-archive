import { memo, useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  AnimatePresence,
} from 'motion/react';
import { cn } from '@/lib/utils';
import type { TimelineTick } from '@/types/timeline';
import { TimelineTickItem } from './timeline-tick';

type SpringConfig = {
  mass?: number;
  stiffness?: number;
  damping?: number;
};

type TimelineScrubberProps = {
  ticks: TimelineTick[];
  visibleMonthKey: string | null;
  onTickClick: (tick: TimelineTick) => void;
  className?: string;
  springConfig?: SpringConfig;
  effectRadius?: number;
  maxScale?: number;
};

// Timeline scrubber with macOS Dock-style magnification and cursor-following label.
// Rectangular ticks (analog clock style), floating label at cursor, year labels fade after 2s.
export const TimelineScrubber = memo(function TimelineScrubber({
  ticks,
  visibleMonthKey,
  onTickClick,
  className,
  springConfig,
  effectRadius,
  maxScale,
}: TimelineScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track hover state for floating label visibility
  const [isHovered, setIsHovered] = useState(false);

  // Track nearest tick index for label content
  const [nearestTickIndex, setNearestTickIndex] = useState<number | null>(null);

  // Mouse position for label (relative to container) - using motion values for spring animation
  const labelXTarget = useMotionValue(0);
  const labelYTarget = useMotionValue(0);

  // Spring config for ~0.15s lag effect
  const labelSpringConfig = { mass: 0.5, stiffness: 300, damping: 25 };
  const labelX = useSpring(labelXTarget, labelSpringConfig);
  const labelY = useSpring(labelYTarget, labelSpringConfig);

  // Year labels visibility (fades after 2s)
  const [yearLabelsVisible, setYearLabelsVisible] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared mouseY position for magnification calculations
  const mouseY = useMotionValue(Infinity);

  // Find nearest tick when mouseY changes
  useMotionValueEvent(mouseY, 'change', (y) => {
    if (y === Infinity || !containerRef.current) {
      setNearestTickIndex(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < tickRefs.current.length; i++) {
      const tickEl = tickRefs.current[i];
      if (!tickEl) continue;

      const tickRect = tickEl.getBoundingClientRect();
      const tickCenterY =
        tickRect.top - containerRect.top + tickRect.height / 2;
      const distance = Math.abs(y - tickCenterY);

      // Earlier date wins on tie (smaller index = earlier date)
      if (
        distance < closestDistance ||
        (distance === closestDistance && i < closestIndex)
      ) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    setNearestTickIndex(closestIndex);
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        mouseY.set(y);

        // Track position for label (relative to container) - spring will add lag
        labelXTarget.set(e.clientX - rect.left);
        labelYTarget.set(y);
      }
    },
    [mouseY, labelXTarget, labelYTarget]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setYearLabelsVisible(true);

    // Start 2s timer to fade year labels
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setYearLabelsVisible(false);
    }, 2000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseY.set(Infinity);

    // Clear timer and reset year labels
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setYearLabelsVisible(true);
  }, [mouseY]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // Handle click on scrubber area - navigate to nearest tick
  const handleClick = useCallback(() => {
    if (nearestTickIndex !== null && ticks[nearestTickIndex]) {
      onTickClick(ticks[nearestTickIndex]);
    }
  }, [nearestTickIndex, ticks, onTickClick]);

  // Get the nearest tick for display
  const nearestTick = useMemo(() => {
    if (nearestTickIndex === null) return null;
    return ticks[nearestTickIndex] ?? null;
  }, [nearestTickIndex, ticks]);

  // Calculate clamped label position to prevent viewport cropping
  // Using useTransform to clamp the spring-animated values
  const clampedLabelX = useTransform(labelX, (x) => {
    const labelWidth = labelRef.current?.offsetWidth ?? 100;
    return Math.max(labelWidth * -1.5, x);
  });

  const clampedLabelY = useTransform(labelY, (y) => {
    const labelHeight = labelRef.current?.offsetHeight ?? 24;
    const containerHeight = containerRef.current?.offsetHeight ?? 0;
    return Math.max(
      labelHeight / 2 + 4,
      Math.min(containerHeight - labelHeight / 2 - 4, y)
    );
  });

  if (ticks.length === 0) return null;

  return (
    // Outer wrapper - tighter hover trigger zone (w-8)
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-8 z-40',
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
          'bg-gradient-to-l from-background via-background/90 to-transparent',

          // Rounded left edge
          'rounded-l-lg',
          // Clickable
          'cursor-pointer'
        )}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        {/* Floating label - follows cursor to the left, shows nearest tick */}
        <AnimatePresence>
          {isHovered && nearestTick && (
            <motion.div
              ref={labelRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute z-20 pointer-events-none',
                'px-3 py-1 rounded-full',
                'bg-foreground text-background',
                'text-base font-medium whitespace-nowrap select-none'
              )}
              style={{
                left: clampedLabelX,
                top: clampedLabelY,
                transform: 'translate(-100%, -50%)',
              }}
            >
              {nearestTick.label}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tick marks */}
        {ticks.map((tick, index) => (
          <TimelineTickItem
            key={tick.key}
            ref={(el) => {
              tickRefs.current[index] = el;
            }}
            tick={tick}
            mouseY={mouseY}
            containerRef={containerRef}
            isActive={visibleMonthKey === tick.key}
            yearLabelsVisible={yearLabelsVisible}
            springConfig={springConfig}
            effectRadius={effectRadius}
            maxScale={maxScale}
          />
        ))}
      </div>
    </div>
  );
});
