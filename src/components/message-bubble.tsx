import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Message, Attachment } from '@/types';
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

// Check if an attachment is a media type (image or video) that should render standalone
function isMediaAttachment(attachment: Attachment): boolean {
  return attachment.type === 'image' || attachment.type === 'video';
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

  // Separate media attachments (images/videos) from non-media attachments
  // Media attachments are NEVER rendered inside bubbles (iMessage behavior)
  const { mediaAttachments, nonMediaAttachments } = useMemo(() => {
    if (!hasAttachments) {
      return { mediaAttachments: [] as Attachment[], nonMediaAttachments: [] as Attachment[] };
    }
    const media: Attachment[] = [];
    const nonMedia: Attachment[] = [];
    for (const attachment of message.attachments) {
      if (isMediaAttachment(attachment)) {
        media.push(attachment);
      } else {
        nonMedia.push(attachment);
      }
    }
    return { mediaAttachments: media, nonMediaAttachments: nonMedia };
  }, [hasAttachments, message.attachments]);

  const hasMediaAttachments = mediaAttachments.length > 0;
  const hasNonMediaAttachments = nonMediaAttachments.length > 0;

  // Filter attachments that can be viewed in lightbox (images and videos)
  const lightboxAttachments = mediaAttachments;

  const handleOpenLightbox = useCallback((index: number) => {
    // Find the index in the lightbox attachments array (media only)
    const attachment = mediaAttachments[index];
    const lightboxIdx = lightboxAttachments.findIndex((a) => a.rowid === attachment.rowid);
    if (lightboxIdx !== -1) {
      setLightboxIndex(lightboxIdx);
      setLightboxOpen(true);
    }
  }, [mediaAttachments, lightboxAttachments]);

  const handleOpenLightboxForNonMedia = useCallback((_index: number) => {
    // Non-media attachments don't open in lightbox
    // This is a no-op but kept for interface consistency
  }, []);

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

          {/* Content wrapper - media attachments are always standalone, never in bubbles */}
          <div className="space-y-1">
            {/* Media attachments (images/videos) - ALWAYS rendered standalone, like iMessage */}
            {hasMediaAttachments && (
              <div className="relative">
                {/* Reactions on media if no text/non-media follows */}
                {hasReactions && !hasText && !hasNonMediaAttachments && (
                  <ReactionPopover
                    reactions={message.reactions}
                    open={showReactionDetails}
                    onOpenChange={setShowReactionDetails}
                  >
                    <div
                      className={cn(
                        'absolute -top-2 cursor-pointer z-10',
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
                <AttachmentGrid
                  attachments={mediaAttachments}
                  onOpenLightbox={handleOpenLightbox}
                />
              </div>
            )}

            {/* Text bubble and/or non-media attachments */}
            {(hasText || hasNonMediaAttachments) && (
              <div className="relative">
                {/* Reactions on bubble */}
                {hasReactions && (hasText || hasNonMediaAttachments) && (
                  <ReactionPopover
                    reactions={message.reactions}
                    open={showReactionDetails}
                    onOpenChange={setShowReactionDetails}
                  >
                    <div
                      className={cn(
                        'absolute -top-2 cursor-pointer z-10',
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
                <div
                  className={cn(
                    'px-4 py-2 rounded-2xl',
                    isFromMe
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                    hasReactions && 'mt-3',
                    hasNonMediaAttachments && 'p-1'
                  )}
                >
                  {hasNonMediaAttachments && hasText ? (
                    <div className="space-y-2">
                      <AttachmentGrid
                        attachments={nonMediaAttachments}
                        onOpenLightbox={handleOpenLightboxForNonMedia}
                      />
                      <p className="whitespace-pre-wrap wrap-break-words px-3 py-1">
                        {displayText}
                      </p>
                    </div>
                  ) : hasNonMediaAttachments ? (
                    <AttachmentGrid
                      attachments={nonMediaAttachments}
                      onOpenLightbox={handleOpenLightboxForNonMedia}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap wrap-break-words">
                      {displayText}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Fallback for messages with no displayable content */}
            {!hasMediaAttachments && !hasText && !hasNonMediaAttachments && (
              <div className="relative">
                {hasReactions && (
                  <ReactionPopover
                    reactions={message.reactions}
                    open={showReactionDetails}
                    onOpenChange={setShowReactionDetails}
                  >
                    <div
                      className={cn(
                        'absolute -top-2 cursor-pointer z-10',
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
                <div
                  className={cn(
                    'px-4 py-2 rounded-2xl',
                    isFromMe
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                    hasReactions && 'mt-3'
                  )}
                >
                  <p className="italic text-sm opacity-70">
                    [Unsupported content]
                  </p>
                </div>
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
