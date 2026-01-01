import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Attachment, Message, Reaction } from '@/types';
import { AttachmentGrid } from '@/components/attachments';
import { MessageReactions } from '@/components/messages/message-reactions';
import { MessageContextMenu } from '@/components/messages/message-context-menu';

type MessageBubbleProps = {
  message: Message;
  text: string | null;
  nonMediaAttachments: Attachment[];
  isFromMe: boolean;
  reactions?: Reaction[];
  showReactionDetails: boolean;
  onShowReactionDetailsChange: (show: boolean) => void;
  // When true, renders "[Unsupported content]" fallback instead of text/attachments
  fallbackMode?: boolean;
};

// Styled bubble for text content with optional non-media attachments
export const MessageBubble = memo(function MessageBubble({
  message,
  text,
  nonMediaAttachments,
  isFromMe,
  reactions,
  showReactionDetails,
  onShowReactionDetailsChange,
  fallbackMode = false,
}: MessageBubbleProps) {
  const hasReactions = reactions && reactions.length > 0;
  const hasNonMediaAttachments = nonMediaAttachments.length > 0;
  const hasText = text && text.length > 0;

  // Non-media attachments don't open in lightbox
  const handleOpenLightbox = useCallback(() => {
    // No-op for non-media attachments
  }, []);

  // Render bubble content based on mode
  const renderContent = () => {
    if (fallbackMode) {
      return (
        <p className="italic text-sm opacity-70">[Unsupported content]</p>
      );
    }

    if (hasNonMediaAttachments && hasText) {
      return (
        <div className="space-y-2">
          <AttachmentGrid
            attachments={nonMediaAttachments}
            onOpenLightbox={handleOpenLightbox}
          />
          <p className="whitespace-pre-wrap wrap-break-words px-3 py-1">
            {text}
          </p>
        </div>
      );
    }

    if (hasNonMediaAttachments) {
      return (
        <AttachmentGrid
          attachments={nonMediaAttachments}
          onOpenLightbox={handleOpenLightbox}
        />
      );
    }

    return <p className="whitespace-pre-wrap wrap-break-words">{text}</p>;
  };

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
            !fallbackMode && hasNonMediaAttachments && 'p-1',
            fallbackMode && hasReactions && 'mt-3'
          )}
        >
          {renderContent()}
        </div>
      </MessageContextMenu>
    </div>
  );
});
