import { memo } from 'react';
import type { Attachment, Reaction } from '@/types';
import { AttachmentGrid } from '@/components/attachments';
import { MessageReactions } from './message-reactions';

type MessageMediaProps = {
  attachments: Attachment[];
  onOpenLightbox: (index: number) => void;
  // Reactions only shown when media is the final content (no text/non-media follows)
  reactions?: Reaction[];
  showReactionDetails: boolean;
  onShowReactionDetailsChange: (show: boolean) => void;
  isFromMe: boolean;
};

// Standalone media attachments (images/videos) - never rendered inside bubbles.
export const MessageMedia = memo(function MessageMedia({
  attachments,
  onOpenLightbox,
  reactions,
  showReactionDetails,
  onShowReactionDetailsChange,
  isFromMe,
}: MessageMediaProps) {
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
      <AttachmentGrid attachments={attachments} onOpenLightbox={onOpenLightbox} />
    </div>
  );
});
