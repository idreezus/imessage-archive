import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { Message, Reaction } from '@/types';
import { MessageReactions } from './message-reactions';
import { MessageContextMenu } from './message-context-menu';

type MessageFallbackProps = {
  message: Message;
  isFromMe: boolean;
  reactions?: Reaction[];
  showReactionDetails: boolean;
  onShowReactionDetailsChange: (show: boolean) => void;
};

// Fallback bubble for messages with no displayable content.
export const MessageFallback = memo(function MessageFallback({
  message,
  isFromMe,
  reactions,
  showReactionDetails,
  onShowReactionDetailsChange,
}: MessageFallbackProps) {
  const hasReactions = reactions && reactions.length > 0;

  return (
    <div className="relative">
      {hasReactions && (
        <MessageReactions
          reactions={reactions}
          isFromMe={isFromMe}
          showDetails={showReactionDetails}
          onShowDetailsChange={onShowReactionDetailsChange}
        />
      )}
      <MessageContextMenu message={message}>
        <div
          className={cn(
            'px-4 py-2 rounded-2xl',
            isFromMe
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
            hasReactions && 'mt-3'
          )}
        >
          <p className="italic text-sm opacity-70">[Unsupported content]</p>
        </div>
      </MessageContextMenu>
    </div>
  );
});
