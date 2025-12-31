import { useCallback, useRef } from 'react';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationItem } from '@/components/conversations/conversation-item';
import { useConversations } from '@/hooks/use-conversations';
import type { Conversation } from '@/types';

// Skeleton that matches ConversationItem's two-row layout
function ConversationItemSkeleton() {
  return (
    <SidebarMenuItem>
      <div className="flex flex-col gap-2 py-4 px-6">
        {/* Top row: name + time */}
        <div className="flex items-center gap-2 w-full">
          <Skeleton className="h-4 flex-1 max-w-[60%]" />
          <Skeleton className="h-3 w-8 shrink-0" />
        </div>
        {/* Bottom row: message preview */}
        <Skeleton className="h-3 w-[85%]" />
      </div>
    </SidebarMenuItem>
  );
}

type ConversationListProps = {
  selectedId: number | null;
  onSelect: (conversation: Conversation) => void;
};

// Scrollable list of conversations with infinite loading.
export function ConversationList({
  selectedId,
  onSelect,
}: ConversationListProps) {
  const { conversations, isLoading, error, hasMore, loadMore } =
    useConversations();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Infinite scroll handler - load more when near bottom.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  // Error state display
  if (error) {
    return (
      <div className="p-4 text-destructive text-sm">Error: {error.message}</div>
    );
  }

  return (
    // Scrollable conversation list container
    <div
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      ref={scrollRef}
    >
      <SidebarMenu className="">
        {/* Initial loading skeletons */}
        {isLoading && conversations.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
            <ConversationItemSkeleton key={i} />
          ))
        ) : (
          <>
            {/* Conversation items */}
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.rowid}
                conversation={conversation}
                isSelected={selectedId === conversation.rowid}
                onSelect={onSelect}
              />
            ))}

            {/* Loading indicator for pagination */}
            {isLoading && <ConversationItemSkeleton />}
          </>
        )}
      </SidebarMenu>
    </div>
  );
}
