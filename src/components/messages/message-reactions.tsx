import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { Reaction } from '@/types';
import { ReactionStack } from '@/components/reactions/reaction-stack';
import { ReactionPopover } from '@/components/reactions/reaction-popover';

type MessageReactionsProps = {
  reactions: Reaction[];
  isFromMe: boolean;
  showDetails: boolean;
  onShowDetailsChange: (show: boolean) => void;
};

// Reaction badge with popover, positioned based on message direction.
export const MessageReactions = memo(function MessageReactions({
  reactions,
  isFromMe,
  showDetails,
  onShowDetailsChange,
}: MessageReactionsProps) {
  return (
    <ReactionPopover
      reactions={reactions}
      open={showDetails}
      onOpenChange={onShowDetailsChange}
    >
      <div
        className={cn(
          'absolute -top-2 cursor-pointer z-10',
          isFromMe ? '-left-1' : '-right-1'
        )}
        onClick={() => onShowDetailsChange(true)}
      >
        <ReactionStack reactions={reactions} isFromMe={isFromMe} />
      </div>
    </ReactionPopover>
  );
});
