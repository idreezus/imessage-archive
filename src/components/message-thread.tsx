import { useRef, useEffect, useCallback, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBubble } from '@/components/message-bubble';
import { ConversationHeader } from '@/components/conversation-header';
import { useMessages } from '@/hooks/use-messages';
import type { Conversation } from '@/types';

type MessageThreadProps = {
  conversation: Conversation | null;
  targetMessageRowid?: number | null;
  onScrollComplete?: () => void;
};

// Message thread panel displaying conversation messages.
export function MessageThread({
  conversation,
  targetMessageRowid,
  onScrollComplete,
}: MessageThreadProps) {
  const { messages, isLoading, hasMore, loadMore, setMessages } = useMessages({
    chatId: conversation?.rowid ?? null,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [highlightedRowid, setHighlightedRowid] = useState<number | null>(null);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);

  // Scroll to bottom on conversation change (but not when targeting a specific message)
  useEffect(() => {
    if (!targetMessageRowid) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.rowid, targetMessageRowid]);

  // Handle target message scrolling
  useEffect(() => {
    if (!targetMessageRowid || !conversation) return;

    // Check if the target message is already in the loaded messages
    const existingMessage = messages.find((m) => m.rowid === targetMessageRowid);

    if (existingMessage) {
      // Message is loaded, scroll to it
      const element = messageRefs.current.get(targetMessageRowid);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedRowid(targetMessageRowid);

        // Remove highlight after animation
        const timer = setTimeout(() => {
          setHighlightedRowid(null);
          onScrollComplete?.();
        }, 2000);

        return () => clearTimeout(timer);
      }
    } else {
      // Message not loaded, fetch messages around the target date
      // We need to find the target message's date first by searching
      setIsLoadingTarget(true);

      // Load messages around the target
      window.electronAPI
        .getMessagesAroundDate(conversation.rowid, Date.now(), 50)
        .then((result) => {
          // Find the target in the result
          const targetMessage = result.messages.find(
            (m) => m.rowid === targetMessageRowid
          );

          if (targetMessage) {
            // Reload messages around the target message's date
            return window.electronAPI.getMessagesAroundDate(
              conversation.rowid,
              targetMessage.date,
              50
            );
          }

          // If not found, try loading more
          return result;
        })
        .then((result) => {
          if (result.messages.length > 0) {
            setMessages(result.messages);

            // Wait for render and then scroll
            requestAnimationFrame(() => {
              const element = messageRefs.current.get(targetMessageRowid);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightedRowid(targetMessageRowid);

                setTimeout(() => {
                  setHighlightedRowid(null);
                  onScrollComplete?.();
                }, 2000);
              } else {
                onScrollComplete?.();
              }
            });
          }
        })
        .catch((error) => {
          console.error('Failed to load messages around target:', error);
          onScrollComplete?.();
        })
        .finally(() => {
          setIsLoadingTarget(false);
        });
    }
  }, [targetMessageRowid, conversation, messages, setMessages, onScrollComplete]);

  // Load older messages when scrolled near top.
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoading || !hasMore) return;

    if (el.scrollTop < 100) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  // Track message element refs
  const setMessageRef = useCallback((rowid: number, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(rowid, element);
    } else {
      messageRefs.current.delete(rowid);
    }
  }, []);

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

        {/* Loading indicator when fetching target message */}
        {isLoadingTarget && (
          <div className="flex justify-center py-4">
            <Skeleton className="h-4 w-32" />
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
              <div
                key={message.rowid}
                ref={(el) => setMessageRef(message.rowid, el)}
              >
                <MessageBubble
                  message={message}
                  showTimestamp={showTimestamp}
                  isGroupChat={conversation.isGroup}
                  isHighlighted={highlightedRowid === message.rowid}
                />
              </div>
            );
          })}
        </div>

        {/* Scroll anchor for auto-scroll to bottom */}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
