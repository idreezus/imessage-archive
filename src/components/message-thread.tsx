import { useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBubble } from '@/components/message-bubble';
import { ConversationHeader } from '@/components/conversation-header';
import { useMessages } from '@/hooks/use-messages';
import type { Conversation } from '@/types';

type MessageThreadProps = {
  conversation: Conversation | null;
};

// Message thread panel displaying conversation messages.
export function MessageThread({ conversation }: MessageThreadProps) {
  const { messages, isLoading, hasMore, loadMore } = useMessages({
    chatId: conversation?.rowid ?? null,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on conversation change or new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.rowid, messages.length]);

  // Load older messages when scrolled near top.
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoading || !hasMore) return;

    if (el.scrollTop < 100) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  // Empty state when no conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a conversation to view messages
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader conversation={conversation} />

      {/* Messages scroll area */}
      <ScrollArea
        className="flex-1 p-4"
        ref={scrollContainerRef}
        onScrollCapture={handleScroll}
      >
        {/* Load more indicator at top */}
        {hasMore && (
          <div className="flex justify-center py-2">
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <button
                onClick={loadMore}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Load earlier messages
              </button>
            )}
          </div>
        )}

        {/* Message list */}
        <div className="space-y-4">
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            // Show timestamp divider for gaps over 1 hour
            const showTimestamp =
              !prevMessage || message.date - prevMessage.date > 3600000;

            return (
              <MessageBubble
                key={message.rowid}
                message={message}
                showTimestamp={showTimestamp}
                isGroupChat={conversation.isGroup}
              />
            );
          })}
        </div>

        {/* Scroll anchor for auto-scroll to bottom */}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
