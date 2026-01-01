import { useRef, useEffect, useCallback } from 'react';
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
import { TimelineScrubber } from '@/components/timeline';
import { useMessages } from '@/hooks/use-messages';
import { useDateIndex } from '@/hooks/use-date-index';
import { useVisibleDateRange } from '@/hooks/use-visible-date-range';
import { useTimelineNavigation } from '@/hooks/use-timeline-navigation';
import { useMessageNavigation } from '@/hooks/use-message-navigation';
import { useRenderTiming } from '@/lib/perf';
import type { Conversation } from '@/types';
import type { NavigationTarget } from '@/types/navigation';

type MessageThreadProps = {
  conversation: Conversation | null;
  navigationTarget?: NavigationTarget | null;
  onNavigationComplete?: () => void;
  onOpenGallery?: (chatId: number, chatName: string) => void;
};

// Context type for virtuoso components
type MessageThreadContext = {
  hasMore: boolean;
  isLoading: boolean;
};

// Header component for loading older messages indicator
function MessageListHeader({
  context,
}: {
  context?: MessageThreadContext;
}) {
  if (!context?.hasMore) return null;
  return (
    <div className="flex justify-center py-4">
      {context.isLoading ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <span className="text-xs text-muted-foreground">
          Scroll up for older messages
        </span>
      )}
    </div>
  );
}

// Stable components object to prevent remounting
const virtuosoComponents = {
  Header: MessageListHeader,
};

// Message thread panel displaying conversation messages with virtualized scrolling
export function MessageThread({
  conversation,
  navigationTarget,
  onNavigationComplete,
  onOpenGallery,
}: MessageThreadProps) {
  const {
    messages,
    isLoading,
    hasMore,
    loadMore,
    setMessages,
    loadedChatId,
    firstItemIndex,
    setFirstItemIndex,
  } = useMessages({
    chatId: conversation?.rowid ?? null,
  });

  // Track render performance
  useRenderTiming('MessageThread', { messageCount: messages.length });

  // Virtuoso ref for imperative scroll control
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Unified message navigation hook
  const { navigateTo, highlightedRowId } = useMessageNavigation({
    virtuosoRef,
    messages,
    chatId: conversation?.rowid ?? null,
    setMessages,
    setFirstItemIndex,
  });

  // Timeline scrubber hooks
  const { ticks, dateIndex } = useDateIndex({
    chatId: conversation?.rowid ?? null,
    source: 'messages',
  });

  const { visibleMonthKey, handleRangeChanged } = useVisibleDateRange({
    items: messages,
    source: 'messages',
  });

  // Timeline navigation - delegates to useMessageNavigation
  const { scrollToDate } = useTimelineNavigation({
    virtuosoRef,
    dateIndex,
    chatId: conversation?.rowid ?? null,
    navigateTo,
  });

  // Handle timeline tick click
  const handleTimelineTickClick = useCallback(
    (tick: { date: number }) => {
      scrollToDate(tick.date);
    },
    [scrollToDate]
  );

  // Check if data is consistent (messages belong to current conversation)
  const isDataReady =
    conversation !== null && loadedChatId === conversation.rowid;

  // Handle navigation target changes - trigger navigation and notify completion
  useEffect(() => {
    if (!navigationTarget || !conversation || !isDataReady) return;

    let isCancelled = false;

    const performNavigation = async () => {
      await navigateTo(navigationTarget);

      // Only notify completion if not cancelled
      if (!isCancelled) {
        onNavigationComplete?.();
      }
    };

    performNavigation();

    return () => {
      isCancelled = true;
    };
  }, [navigationTarget, conversation, isDataReady, navigateTo, onNavigationComplete]);

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
            isHighlighted={highlightedRowId === message.rowid}
          />
        </div>
      );
    },
    [conversation?.isGroup, highlightedRowId, messages]
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
  const showLoading = !isDataReady;

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        conversation={conversation}
        onOpenGallery={onOpenGallery}
      />

      {/* Messages scroll area */}
      <div className="flex-1 overflow-hidden relative">
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
            // Enable stable scroll position when prepending older messages
            firstItemIndex={firstItemIndex}
            // Start at bottom on initial load (chat-style)
            initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
            // Chat-style: align items to bottom when list is short
            alignToBottom={true}
            // Performance tuning
            defaultItemHeight={80}
            overscan={{ main: 100, reverse: 100 }}
            // Load older messages when reaching top
            startReached={handleStartReached}
            // Track visible range for timeline scrubber
            rangeChanged={handleRangeChanged}
            // Render each message
            itemContent={renderMessage}
            // Stable key for each item
            computeItemKey={(_, message) => message.rowid}
            // Pass dynamic state to Header via context
            context={{ hasMore, isLoading }}
            components={virtuosoComponents}
            // Add top padding to first item
            style={{ height: '100%' }}
            className="pt-4"
          />
        )}

        {/* Timeline scrubber for date navigation */}
        {isDataReady && ticks.length > 0 && (
          <TimelineScrubber
            ticks={ticks}
            visibleMonthKey={visibleMonthKey}
            onTickClick={handleTimelineTickClick}
          />
        )}
      </div>
    </div>
  );
}
