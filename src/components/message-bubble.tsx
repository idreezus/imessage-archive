import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import { ReactionStack } from './reaction-stack';
import { ReactionPopover } from './reaction-popover';
import { AttachmentGrid, Lightbox } from './attachments';

type MessageBubbleProps = {
  message: Message;
  showTimestamp: boolean;
  isGroupChat: boolean;
  isHighlighted?: boolean;
};

// Format timestamp as time string (e.g., "2:30 PM").
function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format timestamp as date string with relative terms.
function formatDate(timestamp: number): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Individual message bubble with styling based on sender and service.
export function MessageBubble({
  message,
  showTimestamp,
  isGroupChat,
  isHighlighted = false,
}: MessageBubbleProps) {
  const [showReactionDetails, setShowReactionDetails] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isFromMe = message.isFromMe;
  const hasReactions = message.reactions && message.reactions.length > 0;
  const hasAttachments = message.attachments && message.attachments.length > 0;
  // Clean text by removing object replacement chars and trimming
  const displayText = message.text?.replace(/\ufffc/g, '').trim() || null;
  const hasText = displayText && displayText.length > 0;

  // Filter attachments that can be viewed in lightbox (images and videos)
  const lightboxAttachments = hasAttachments
    ? message.attachments.filter((a) => a.type === 'image' || a.type === 'video')
    : [];

  const handleOpenLightbox = useCallback((index: number) => {
    // Find the index in the lightbox attachments array
    const attachment = message.attachments[index];
    const lightboxIdx = lightboxAttachments.findIndex((a) => a.rowid === attachment.rowid);
    if (lightboxIdx !== -1) {
      setLightboxIndex(lightboxIdx);
      setLightboxOpen(true);
    }
  }, [message.attachments, lightboxAttachments]);

  return (
    <div
      className={cn(
        'space-y-1 transition-all duration-300',
        isHighlighted && 'bg-primary/10 -mx-2 px-2 py-1 rounded-lg ring-2 ring-primary/30'
      )}
    >
      {/* Timestamp divider for message gaps */}
      {showTimestamp && (
        <div className="flex justify-center py-2">
          <span className="text-xs text-muted-foreground font-mono">
            {formatDate(message.date)} {formatTime(message.date)}
          </span>
        </div>
      )}

      {/* Message bubble container */}
      <div className={cn('flex', isFromMe ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%]">
          {/* Sender name for received messages in group chats */}
          {!isFromMe && isGroupChat && message.senderHandle && (
            <p className="text-xs text-muted-foreground font-mono mb-1 ml-3">
              {message.senderHandle.id}
            </p>
          )}

          {/* Bubble wrapper with relative positioning for reactions */}
          <div className="relative">
            {/* Reaction stack */}
            {hasReactions && (
              <ReactionPopover
                reactions={message.reactions}
                open={showReactionDetails}
                onOpenChange={setShowReactionDetails}
              >
                <div
                  className={cn(
                    'absolute -top-2 cursor-pointer',
                    isFromMe ? '-left-1' : '-right-1'
                  )}
                  onClick={() => setShowReactionDetails(true)}
                >
                  <ReactionStack
                    reactions={message.reactions}
                    isFromMe={isFromMe}
                  />
                </div>
              </ReactionPopover>
            )}

            {/* Attachment-only messages: render without bubble wrapper */}
            {hasAttachments && !hasText ? (
              <div className={cn(hasReactions && 'mt-3')}>
                <AttachmentGrid
                  attachments={message.attachments}
                  onOpenLightbox={handleOpenLightbox}
                />
              </div>
            ) : (
              /* Message bubble with theme-based coloring */
              <div
                className={cn(
                  'px-4 py-2 rounded-2xl',
                  isFromMe
                    ? 'bg-primary text-primary-foreground' // Sent: darker theme color
                    : 'bg-muted text-foreground', // Received: muted background
                  // Add top margin when reactions present to avoid overlap
                  hasReactions && 'mt-3',
                  // Adjust padding for attachments with text
                  hasAttachments && 'p-1'
                )}
              >
                {hasAttachments ? (
                  <div className="space-y-2">
                    <AttachmentGrid
                      attachments={message.attachments}
                      onOpenLightbox={handleOpenLightbox}
                    />
                    <p className="whitespace-pre-wrap wrap-break-words px-3 py-1">
                      {displayText}
                    </p>
                  </div>
                ) : hasText ? (
                  <p className="whitespace-pre-wrap wrap-break-words">
                    {displayText}
                  </p>
                ) : (
                  <p className="italic text-sm opacity-70">
                    [Unsupported content]
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox for viewing images and videos */}
      {lightboxAttachments.length > 0 && (
        <Lightbox
          attachments={lightboxAttachments}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
