import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Reaction } from '@/types';
import { getDisplayReactions } from '@/lib/reactions';
import { ReactionBadge } from './reaction-badge';

type ReactionStackProps = {
  reactions: Reaction[];
  isFromMe: boolean;
  maxVisible?: number;
};

// Stacked reaction badges with overlap effect.
// Memoized to prevent re-renders when parent message re-renders.
export const ReactionStack = memo(function ReactionStack({
  reactions,
  isFromMe,
  maxVisible = 3,
}: ReactionStackProps) {
  const { visible, overflow } = useMemo(
    () => getDisplayReactions(reactions, maxVisible),
    [reactions, maxVisible]
  );

  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center',
        // Stack direction: reactions flow toward the bubble
        isFromMe ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {visible.map((reaction, index) => (
        <ReactionBadge
          key={reaction.type}
          emoji={reaction.emoji}
          count={reaction.count}
          isFromMe={isFromMe}
          className={cn(
            // Negative margin for overlap effect (skip first)
            index > 0 && (isFromMe ? '-mr-1.5' : '-ml-1.5'),
            // Z-index stacking (first reaction on top)
            index === 0 && 'z-3',
            index === 1 && 'z-2',
            index === 2 && 'z-1'
          )}
        />
      ))}

      {overflow > 0 && (
        <span
          className={cn(
            'text-[10px] text-muted-foreground font-medium',
            isFromMe ? 'mr-1' : 'ml-1'
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
});
