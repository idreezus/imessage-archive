import { memo } from 'react';
import { cn } from '@/lib/utils';

type ReactionBadgeProps = {
  emoji: string;
  count?: number;
  isFromMe: boolean;
  className?: string;
};

// Single reaction badge showing emoji and optional count.
// Memoized to prevent re-renders when sibling reactions change.
export const ReactionBadge = memo(function ReactionBadge({
  emoji,
  count,
  isFromMe,
  className,
}: ReactionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center',
        'h-6 min-w-6 px-1.5 rounded-full',
        'border border-border/50',
        'shadow-sm',
        // Match message bubble colors
        isFromMe
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground',
        className
      )}
    >
      <span className="text-base leading-none">{emoji}</span>
      {count && count > 1 && (
        <span
          className={cn(
            'ml-0.5 text-[11px] font-medium',
            isFromMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}
        >
          {count}
        </span>
      )}
    </span>
  );
});
