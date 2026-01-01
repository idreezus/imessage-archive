import { useState, memo } from 'react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import { Lightbox } from '@/components/lightbox';
import { useMessageAttachments } from '@/hooks/use-message-attachments';
import { useLightbox } from '@/hooks/use-lightbox';
import { MessageTimestamp } from '@/components/messages/message-timestamp';
import { MessageSender } from '@/components/messages/message-sender';
import { MessageMedia } from '@/components/messages/message-media';
import { MessageBubble } from '@/components/messages/message-bubble';

type MessageItemProps = {
  message: Message;
  showTimestamp: boolean;
  isGroupChat: boolean;
  isHighlighted?: boolean;
};

// Orchestrator component for rendering individual message items
export const MessageItem = memo(function MessageItem({
  message,
  showTimestamp,
  isGroupChat,
  isHighlighted = false,
}: MessageItemProps) {
  const [showReactionDetails, setShowReactionDetails] = useState(false);

  // Derived state
  const isFromMe = message.isFromMe;
  const hasReactions = message.reactions && message.reactions.length > 0;
  const displayText = message.text?.replace(/\ufffc/g, '').trim() || null;
  const hasText = displayText && displayText.length > 0;

  // Separate media and non-media attachments
  const {
    mediaAttachments,
    nonMediaAttachments,
    hasMediaAttachments,
    hasNonMediaAttachments,
  } = useMessageAttachments(message.attachments);

  // Lightbox state management
  const { lightboxOpen, lightboxIndex, openLightbox, closeLightbox } =
    useLightbox(mediaAttachments);

  // Determine where reactions should appear (on last content element)
  const showReactionsOnMedia =
    hasReactions && !hasText && !hasNonMediaAttachments;
  const showReactionsOnBubble =
    hasReactions && (hasText || hasNonMediaAttachments);
  const showReactionsOnFallback =
    hasReactions && !hasMediaAttachments && !hasText && !hasNonMediaAttachments;

  return (
    <div
      className={cn(
        'space-y-1 transition-all duration-300',
        isHighlighted &&
          'bg-primary/10 -mx-2 px-2 py-1 rounded-lg ring-2 ring-primary/30'
      )}
    >
      {showTimestamp && <MessageTimestamp timestamp={message.date} />}

      <div className={cn('flex', isFromMe ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%]">
          {!isFromMe && isGroupChat && message.senderHandle && (
            <MessageSender senderHandle={message.senderHandle} />
          )}

          <div className="space-y-1">
            {hasMediaAttachments && (
              <MessageMedia
                attachments={mediaAttachments}
                onOpenLightbox={openLightbox}
                reactions={showReactionsOnMedia ? message.reactions : undefined}
                showReactionDetails={showReactionDetails}
                onShowReactionDetailsChange={setShowReactionDetails}
                isFromMe={isFromMe}
              />
            )}

            {(hasText || hasNonMediaAttachments) && (
              <MessageBubble
                message={message}
                text={displayText}
                nonMediaAttachments={nonMediaAttachments}
                isFromMe={isFromMe}
                reactions={
                  showReactionsOnBubble ? message.reactions : undefined
                }
                showReactionDetails={showReactionDetails}
                onShowReactionDetailsChange={setShowReactionDetails}
              />
            )}

            {!hasMediaAttachments && !hasText && !hasNonMediaAttachments && (
              <MessageBubble
                message={message}
                text={null}
                nonMediaAttachments={[]}
                isFromMe={isFromMe}
                reactions={
                  showReactionsOnFallback ? message.reactions : undefined
                }
                showReactionDetails={showReactionDetails}
                onShowReactionDetailsChange={setShowReactionDetails}
                fallbackMode
              />
            )}
          </div>
        </div>
      </div>

      {mediaAttachments.length > 0 && (
        <Lightbox
          attachments={mediaAttachments}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
});
