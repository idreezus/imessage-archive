import { memo, useMemo, useCallback } from 'react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import type { Conversation } from '@/types';

type ConversationItemProps = {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (conversation: Conversation) => void;
};

// Format timestamp as relative time string.
function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return new Date(timestamp).toLocaleDateString();
}

// Get display name from conversation or participants.
function getDisplayName(conversation: Conversation): string {
  if (conversation.displayName) {
    return conversation.displayName;
  }

  if (conversation.participants.length === 0) {
    return conversation.chatIdentifier;
  }

  if (conversation.participants.length === 1) {
    return conversation.participants[0].id;
  }

  // Group chat: show first few participant IDs
  return conversation.participants
    .slice(0, 3)
    .map((p) => p.id)
    .join(', ');
}

// Single conversation row in the sidebar list.
// Memoized to prevent unnecessary re-renders when parent state changes.
export const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onSelect,
}: ConversationItemProps) {
  // Memoize computed values to avoid recalculation on every render
  const displayName = useMemo(
    () => getDisplayName(conversation),
    [conversation]
  );
  const timeAgo = useMemo(
    () => formatRelativeTime(conversation.lastMessageDate),
    [conversation.lastMessageDate]
  );

  // Stable click handler
  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  return (
    <SidebarMenuItem>
      {/* Clickable conversation button */}
      <SidebarMenuButton
        isActive={isSelected}
        onClick={handleClick}
        size="lg"
        className="flex flex-col gap-1 py-4 px-6 h-auto"
      >
        {/* Top row: name, time */}
        <div className="flex items-center gap-2 w-full min-w-0">
          <span className="font-medium truncate flex-1 min-w-0">
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {timeAgo}
          </span>
        </div>

        {/* Last message preview */}
        {conversation.lastMessageText && (
          <span className="text-xs text-muted-foreground truncate w-full min-w-0">
            {conversation.lastMessageText}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
