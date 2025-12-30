import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types";

type ConversationHeaderProps = {
  conversation: Conversation;
  onOpenGallery?: (chatId: number, chatName: string) => void;
};

// Get display name for conversation header.
function getHeaderTitle(conversation: Conversation): string {
  if (conversation.displayName) {
    return conversation.displayName;
  }

  if (conversation.participants.length === 1) {
    return conversation.participants[0].id;
  }

  if (conversation.participants.length > 1) {
    return `${conversation.participants.length} participants`;
  }

  return conversation.chatIdentifier;
}

// Sticky header for the message thread.
export function ConversationHeader({
  conversation,
  onOpenGallery,
}: ConversationHeaderProps) {
  const title = getHeaderTitle(conversation);

  return (
    <div className="sticky top-0 z-10 border-b bg-background px-4 py-3 shrink-0 flex items-center justify-between">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {conversation.isGroup && (
          <p className="text-sm text-muted-foreground">
            {conversation.participants.length} participants
          </p>
        )}
      </div>
      {onOpenGallery && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenGallery(conversation.rowid, title)}
          aria-label="View attachments"
        >
          <Images className="size-5" />
        </Button>
      )}
    </div>
  );
}
