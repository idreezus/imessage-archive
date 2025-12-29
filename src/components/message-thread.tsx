import { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
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
  const { messages, isLoading, hasMore, loadMore, setMessages, loadedChatId } = useMessages({
    chatId: conversation?.rowid ?? null,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [highlightedRowid, setHighlightedRowid] = useState<number | null>(null);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);

  // Track scroll position for load-more preservation
  const prevScrollHeightRef = useRef<number>(0);
  const isLoadingMoreRef = useRef(false);

  // Check if data is consistent (messages belong to current conversation)
  const isDataReady = conversation !== null && loadedChatId === conversation.rowid;

  // Scroll to bottom using the sentinel div - more reliable than scrollHeight
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'instant') => {
    // Use scrollIntoView on sentinel div - most reliable cross-browser method
    bottomRef.current?.scrollIntoView({
      behavior,
      block: 'end',
    });
  }, []);

  // Scroll to bottom when messages first load for a conversation (not on load-more)
  useLayoutEffect(() => {
    if (!isDataReady || targetMessageRowid) return;

    // Don't scroll to bottom if we're loading more (prepending older messages)
    if (isLoadingMoreRef.current) {
      // Preserve scroll position when prepending
      const el = scrollContainerRef.current;
      if (el && prevScrollHeightRef.current > 0) {
        const heightDiff = el.scrollHeight - prevScrollHeightRef.current;
        el.scrollTop += heightDiff;
      }
      prevScrollHeightRef.current = 0;
      isLoadingMoreRef.current = false;
      return;
    }

    // Initial load or conversation switch - scroll to bottom
    // Use requestAnimationFrame to ensure DOM is fully painted
    requestAnimationFrame(() => {
      scrollToBottom('instant');
    });
  }, [isDataReady, messages, targetMessageRowid, scrollToBottom]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoading || !hasMore || !isDataReady) return;

    // Near top = load more older messages
    if (el.scrollTop < 100) {
      prevScrollHeightRef.current = el.scrollHeight;
      isLoadingMoreRef.current = true;
      loadMore();
    }
  }, [isLoading, hasMore, isDataReady, loadMore]);

  // Handle target message scrolling (search result navigation)
  useEffect(() => {
    if (!targetMessageRowid || !conversation || !isDataReady) return;

    const existingMessage = messages.find((m) => m.rowid === targetMessageRowid);

    if (existingMessage) {
      const element = messageRefs.current.get(targetMessageRowid);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedRowid(targetMessageRowid);

        const timer = setTimeout(() => {
          setHighlightedRowid(null);
          onScrollComplete?.();
        }, 2000);

        return () => clearTimeout(timer);
      }
    } else {
      // Message not loaded, fetch messages around the target
      setIsLoadingTarget(true);

      window.electronAPI
        .getMessagesAroundDate(conversation.rowid, Date.now(), 50)
        .then((result) => {
          const targetMessage = result.messages.find(
            (m) => m.rowid === targetMessageRowid
          );

          if (targetMessage) {
            return window.electronAPI.getMessagesAroundDate(
              conversation.rowid,
              targetMessage.date,
              50
            );
          }

          return result;
        })
        .then((result) => {
          if (result.messages.length > 0) {
            setMessages(result.messages);

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
  }, [targetMessageRowid, conversation, messages, setMessages, onScrollComplete, isDataReady]);

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

  // Loading state while fetching messages for new conversation
  const showLoading = !isDataReady || isLoadingTarget;

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader conversation={conversation} />

      {/* Messages scroll area */}
      <div
        className="flex-1 overflow-y-auto p-4"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {showLoading ? (
          // Loading skeleton while fetching messages
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <Skeleton className={`h-12 ${i % 3 === 0 ? 'w-48' : 'w-32'} rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Load more indicator at top */}
            {hasMore && (
              <div className="flex justify-center py-2">
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <button
                    onClick={() => {
                      prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0;
                      isLoadingMoreRef.current = true;
                      loadMore();
                    }}
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

            {/* Sentinel div for scrollIntoView - invisible anchor at bottom */}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
