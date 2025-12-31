import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Attachment, Message, Reaction } from '@/types';
import { AttachmentGrid } from '@/components/attachments';
import { MessageReactions } from '@/components/messages/message-reactions';
import { MessageContextMenu } from '@/components/messages/message-context-menu';

type MessageTextBubbleProps = {
  message: Message;
  text: string | null;
  nonMediaAttachments: Attachment[];
  isFromMe: boolean;
  reactions?: Reaction[];
  showReactionDetails: boolean;
  onShowReactionDetailsChange: (show: boolean) => void;
};

// Text bubble with optional non-media attachments (audio, documents, etc.).
export const MessageTextBubble = memo(function MessageTextBubble({
  message,
  text,
  nonMediaAttachments,
  isFromMe,
  reactions,
  showReactionDetails,
  onShowReactionDetailsChange,
}: MessageTextBubbleProps) {
  const hasReactions = reactions && reactions.length > 0;
  const hasNonMediaAttachments = nonMediaAttachments.length > 0;
  const hasText = text && text.length > 0;

  // Non-media attachments don't open in lightbox
  const handleOpenLightbox = useCallback((_index: number) => {
    // No-op for non-media attachments
  }, []);

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
            'px-4 py-2 rounded-2xl w-fit',
            isFromMe
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
            hasNonMediaAttachments && 'p-1'
          )}
        >
          {hasNonMediaAttachments && hasText ? (
            <div className="space-y-2">
              <AttachmentGrid
                attachments={nonMediaAttachments}
                onOpenLightbox={handleOpenLightbox}
              />
              <p className="whitespace-pre-wrap wrap-break-words px-3 py-1">
                {text}
              </p>
            </div>
          ) : hasNonMediaAttachments ? (
            <AttachmentGrid
              attachments={nonMediaAttachments}
              onOpenLightbox={handleOpenLightbox}
            />
          ) : (
            <p className="whitespace-pre-wrap wrap-break-words">{text}</p>
          )}
        </div>
      </MessageContextMenu>
    </div>
  );
});
