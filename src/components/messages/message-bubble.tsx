import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import { Lightbox } from '@/components/lightbox';
import { useMessageAttachments } from '@/hooks/use-message-attachments';
import { useMessageLightbox } from '@/hooks/use-message-lightbox';
import { MessageTimestamp } from '@/components/messages/message-timestamp';
import { MessageSender } from '@/components/messages/message-sender';
import { MessageMedia } from '@/components/messages/message-media';
import { MessageTextBubble } from '@/components/messages/message-text-bubble';
import { MessageFallback } from '@/components/messages/message-fallback';

type MessageBubbleProps = {
  message: Message;
  showTimestamp: boolean;
  isGroupChat: boolean;
  isHighlighted?: boolean;
};

// Orchestrator component for rendering individual message bubbles.
export function MessageBubble({
  message,
  showTimestamp,
  isGroupChat,
  isHighlighted = false,
}: MessageBubbleProps) {
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
    useMessageLightbox(mediaAttachments);

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
              <MessageTextBubble
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
              <MessageFallback
                message={message}
                isFromMe={isFromMe}
                reactions={
                  showReactionsOnFallback ? message.reactions : undefined
                }
                showReactionDetails={showReactionDetails}
                onShowReactionDetailsChange={setShowReactionDetails}
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
}
