import { useRef, useEffect, useCallback, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { MessageBubble } from '@/components/messages';
import { ConversationHeader } from '@/components/conversations/conversation-header';
import { useMessages } from '@/hooks/use-messages';
import { useRenderTiming } from '@/lib/perf';
import type { Conversation } from '@/types';

type MessageThreadProps = {
  conversation: Conversation | null;
  targetMessageRowid?: number | null;
  onScrollComplete?: () => void;
  onOpenGallery?: (chatId: number, chatName: string) => void;
};

// Message thread panel displaying conversation messages with virtualized scrolling.
export function MessageThread({
  conversation,
  targetMessageRowid,
  onScrollComplete,
  onOpenGallery,
}: MessageThreadProps) {
  const { messages, isLoading, hasMore, loadMore, setMessages, loadedChatId } =
    useMessages({
      chatId: conversation?.rowid ?? null,
    });

  // Track render performance
  useRenderTiming('MessageThread', { messageCount: messages.length });

  // Virtuoso ref for imperative scroll control
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // State for highlighting target message after navigation
  const [highlightedRowid, setHighlightedRowid] = useState<number | null>(null);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);

  // Check if data is consistent (messages belong to current conversation)
  const isDataReady =
    conversation !== null && loadedChatId === conversation.rowid;

  // Handle target message scrolling (search result navigation)
  useEffect(() => {
    if (!targetMessageRowid || !conversation || !isDataReady) return;

    const existingMessage = messages.find(
      (m) => m.rowid === targetMessageRowid
    );

    if (existingMessage) {
      // Message is already loaded - find index and scroll
      const targetIndex = messages.findIndex(
        (m) => m.rowid === targetMessageRowid
      );

      if (targetIndex !== -1) {
        // Use requestAnimationFrame to ensure virtuoso has rendered
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align: 'center',
            behavior: 'auto',
          });

          setHighlightedRowid(targetMessageRowid);

          const timer = setTimeout(() => {
            setHighlightedRowid(null);
            onScrollComplete?.();
          }, 2000);

          return () => clearTimeout(timer);
        });
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

            // After messages are set, scroll to target
            requestAnimationFrame(() => {
              const targetIndex = result.messages.findIndex(
                (m) => m.rowid === targetMessageRowid
              );

              if (targetIndex !== -1) {
                // Double RAF to ensure virtuoso has fully rendered new data
                requestAnimationFrame(() => {
                  virtuosoRef.current?.scrollToIndex({
                    index: targetIndex,
                    align: 'center',
                    behavior: 'auto',
                  });

                  setHighlightedRowid(targetMessageRowid);

                  setTimeout(() => {
                    setHighlightedRowid(null);
                    onScrollComplete?.();
                  }, 2000);
                });
              } else {
                onScrollComplete?.();
              }
            });
          } else {
            onScrollComplete?.();
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
  }, [
    targetMessageRowid,
    conversation,
    messages,
    setMessages,
    onScrollComplete,
    isDataReady,
  ]);

  // Handle infinite scroll - load older messages when reaching top
  const handleStartReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Render individual message item
  const renderMessage = useCallback(
    (index: number, message: (typeof messages)[0]) => {
      const prevMessage = messages[index - 1];
      const showTimestamp =
        !prevMessage || message.date - prevMessage.date > 3600000;

      return (
        <div className="pb-4 px-4">
          <MessageBubble
            message={message}
            showTimestamp={showTimestamp}
            isGroupChat={conversation?.isGroup ?? false}
            isHighlighted={highlightedRowid === message.rowid}
          />
        </div>
      );
    },
    [conversation?.isGroup, highlightedRowid, messages]
  );

  // Empty state when no conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Empty>
          <EmptyMedia variant="icon">
            <MessageSquare className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No conversation selected</EmptyTitle>
          <EmptyDescription>
            Select a conversation from the sidebar to view messages
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Loading state while fetching messages for new conversation
  const showLoading = !isDataReady || isLoadingTarget;

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        conversation={conversation}
        onOpenGallery={onOpenGallery}
      />

      {/* Messages scroll area */}
      <div className="flex-1 overflow-hidden">
        {showLoading ? (
          // Loading skeleton while fetching messages
          <div className="p-4 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${
                  i % 2 === 0 ? 'justify-end' : 'justify-start'
                }`}
              >
                <Skeleton
                  className={`h-12 ${
                    i % 3 === 0 ? 'w-48' : 'w-32'
                  } rounded-2xl`}
                />
              </div>
            ))}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            // Start at bottom on initial load
            initialTopMostItemIndex={
              messages.length > 0 ? messages.length - 1 : 0
            }
            // Chat-style: align items to bottom when list is short
            alignToBottom={true}
            // Performance tuning
            defaultItemHeight={80}
            overscan={{ main: 200, reverse: 200 }}
            // Load older messages when reaching top
            startReached={handleStartReached}
            // Render each message
            itemContent={renderMessage}
            // Stable key for each item
            computeItemKey={(_, message) => message.rowid}
            // Header shows loading indicator when fetching older messages
            components={{
              Header: () =>
                hasMore ? (
                  <div className="flex justify-center py-4">
                    {isLoading ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Scroll up for older messages
                      </span>
                    )}
                  </div>
                ) : null,
            }}
            // Add top padding to first item
            style={{ height: '100%' }}
            className="pt-4"
          />
        )}
      </div>
    </div>
  );
}
