import { forwardRef, useRef, useEffect } from 'react';
import {
  motion,
  useTransform,
  useSpring,
  type MotionValue,
} from 'motion/react';
import { cn } from '@/lib/utils';
import type { TimelineTick } from '@/types/timeline';

type SpringConfig = {
  mass?: number;
  stiffness?: number;
  damping?: number;
};

type TimelineTickProps = {
  tick: TimelineTick;
  mouseY: MotionValue<number>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  yearLabelsVisible: boolean;
  springConfig?: SpringConfig;
  effectRadius?: number;
  maxScale?: number;
};

const DEFAULT_SPRING_CONFIG: SpringConfig = {
  mass: 0.2,
  stiffness: 150,
  damping: 12,
};

// Individual timeline tick with macOS Dock-style magnification.
// Renders rectangular tick mark (analog clock style) and optional year label.
export const TimelineTickItem = forwardRef<HTMLDivElement, TimelineTickProps>(
  function TimelineTickItem(
    {
      tick,
      mouseY,
      containerRef,
      isActive,
      yearLabelsVisible,
      springConfig = DEFAULT_SPRING_CONFIG,
      effectRadius = 120,
      maxScale = 2.5,
    },
    forwardedRef
  ) {
    const internalRef = useRef<HTMLDivElement>(null);

    // Sync internal ref to forwarded ref
    useEffect(() => {
      if (typeof forwardedRef === 'function') {
        forwardedRef(internalRef.current);
      } else if (forwardedRef) {
        forwardedRef.current = internalRef.current;
      }
    }, [forwardedRef]);

    // Calculate distance from mouse to this tick's center
    const distance = useTransform(mouseY, (y) => {
      if (!internalRef.current || !containerRef.current) return Infinity;

      const containerRect = containerRef.current.getBoundingClientRect();
      const tickRect = internalRef.current.getBoundingClientRect();
      const tickCenterY =
        tickRect.top - containerRect.top + tickRect.height / 2;

      return Math.abs(y - tickCenterY);
    });

    // Transform distance to scale (closer = larger, uniform scaling)
    const scaleTransform = useTransform(distance, (d) => {
      if (d >= effectRadius) return 1;
      // Cosine falloff for smooth transition (matches macOS Dock feel)
      const normalized = d / effectRadius;
      const cosValue = Math.cos((normalized * Math.PI) / 2);
      return 1 + (maxScale - 1) * cosValue;
    });

    // Apply spring physics for smooth animation
    const scale = useSpring(scaleTransform, springConfig);

    return (
      <motion.div
        ref={internalRef}
        className={cn('flex items-center gap-1.5 py-0.5 pr-2', 'origin-right')}
        style={{
          scale,
          transformOrigin: 'right center',
        }}
      >
        {/* Year label - fades out after 2s of hover */}
        {tick.isYearStart && tick.yearLabel && (
          <motion.span
            initial={{ opacity: 1 }}
            animate={{ opacity: yearLabelsVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'text-right whitespace-nowrap select-none text-[11px] z-10',
              isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {tick.yearLabel}
          </motion.span>
        )}

        {/* Rectangular tick mark */}
        <div
          className={cn(
            'flex-shrink-0 transition-colors duration-100',
            isActive ? 'bg-primary' : 'bg-muted-foreground/40',
            tick.isYearStart && !isActive && 'bg-foreground/60'
          )}
          style={{
            width: tick.isYearStart ? 8 : 4,
            height: tick.isYearStart ? 2 : 1,
          }}
        />
      </motion.div>
    );
  }
);
