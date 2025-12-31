import { useState, useEffect, useRef } from 'react';

type UseDockMagnificationOptions = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  mouseY: number | null;
  tickCount: number;
  isActive: boolean;
  maxScale?: number;
  effectRadius?: number;
};

type UseDockMagnificationReturn = {
  tickScales: number[];
  tickRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
};

// macOS Dock-style magnification effect hook.
// Calculates scale values for each tick based on mouse proximity using cosine falloff.
export function useDockMagnification(
  options: UseDockMagnificationOptions
): UseDockMagnificationReturn {
  const {
    containerRef,
    mouseY,
    tickCount,
    isActive,
    maxScale = 1.8,
    effectRadius = 80,
  } = options;

  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tickScales, setTickScales] = useState<number[]>(() =>
    Array(tickCount).fill(1)
  );

  // Animation frame ref for smooth updates
  const rafRef = useRef<number | null>(null);
  const targetScalesRef = useRef<number[]>(Array(tickCount).fill(1));
  const currentScalesRef = useRef<number[]>(Array(tickCount).fill(1));

  // Calculate target scales based on mouse position
  useEffect(() => {
    if (!isActive || mouseY === null || !containerRef.current) {
      // Reset to 1.0 when not hovered
      targetScalesRef.current = Array(tickCount).fill(1);
      return;
    }

    const newTargets: number[] = [];
    const containerRect = containerRef.current.getBoundingClientRect();

    for (let i = 0; i < tickCount; i++) {
      const tickEl = tickRefs.current[i];
      if (!tickEl) {
        newTargets.push(1);
        continue;
      }

      const rect = tickEl.getBoundingClientRect();
      const tickCenterY = rect.top - containerRect.top + rect.height / 2;

      const distance = Math.abs(mouseY - tickCenterY);

      if (distance > effectRadius) {
        newTargets.push(1);
      } else {
        // Cosine falloff for smooth transition (matches macOS Dock feel)
        const normalized = distance / effectRadius;
        const cosValue = Math.cos((normalized * Math.PI) / 2);
        const scale = 1 + (maxScale - 1) * cosValue;
        newTargets.push(scale);
      }
    }

    targetScalesRef.current = newTargets;
  }, [mouseY, tickCount, isActive, maxScale, effectRadius, containerRef]);

  // Animate scales with spring-like interpolation
  useEffect(() => {
    const animate = () => {
      const current = currentScalesRef.current;
      const targets = targetScalesRef.current;

      let needsUpdate = false;
      const newScales: number[] = [];

      for (let i = 0; i < tickCount; i++) {
        const target = targets[i] ?? 1;
        const curr = current[i] ?? 1;

        // Lerp with easing (0.25 = responsive but smooth)
        const diff = target - curr;
        if (Math.abs(diff) > 0.001) {
          const next = curr + diff * 0.25;
          newScales.push(next);
          needsUpdate = true;
        } else {
          newScales.push(target);
        }
      }

      currentScalesRef.current = newScales;

      if (needsUpdate) {
        setTickScales([...newScales]);
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setTickScales([...newScales]);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [tickCount]);

  // Ensure refs array is correct size
  useEffect(() => {
    tickRefs.current = tickRefs.current.slice(0, tickCount);
    while (tickRefs.current.length < tickCount) {
      tickRefs.current.push(null);
    }
  }, [tickCount]);

  return { tickScales, tickRefs };
}
