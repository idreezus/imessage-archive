import { memo, useMemo, useCallback } from "react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { SearchResultItem as SearchResultItemType } from "@/types/search";
import { formatDistanceToNow } from "date-fns";

type SearchResultItemProps = {
  result: SearchResultItemType;
  onResultClick: (result: SearchResultItemType) => void;
  isSelected?: boolean;
};

function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return formatDistanceToNow(date, { addSuffix: false });
  } else if (diffInDays < 7) {
    return `${diffInDays}d`;
  } else if (diffInDays < 30) {
    return `${Math.floor(diffInDays / 7)}w`;
  } else if (diffInDays < 365) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } else {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
}

// Memoized search result item to prevent unnecessary re-renders.
export const SearchResultItem = memo(function SearchResultItem({
  result,
  onResultClick,
  isSelected = false,
}: SearchResultItemProps) {
  const displayName = useMemo(
    () => result.chatDisplayName || result.senderHandle || "Unknown",
    [result.chatDisplayName, result.senderHandle]
  );

  const timeAgo = useMemo(
    () => formatRelativeTime(result.date),
    [result.date]
  );

  // Stable click handler - only recreated when result or handler changes
  const handleClick = useCallback(() => {
    onResultClick(result);
  }, [onResultClick, result]);

  return (
    <SidebarMenuButton
      isActive={isSelected}
      onClick={handleClick}
      className="flex flex-col gap-1 py-3 px-4 h-auto items-start"
    >
      {/* Header: chat name + time */}
      <div className="flex items-center gap-2 w-full">
        <span className="font-medium text-sm truncate flex-1">
          {displayName}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {timeAgo}
        </span>
      </div>

      {/* Sender indicator for group chats */}
      {result.chatIsGroup && (
        <span className="text-xs text-muted-foreground">
          {result.isFromMe ? "You" : result.senderHandle || "Unknown"}
        </span>
      )}

      {/* Message snippet with highlight */}
      <p
        className="text-sm text-muted-foreground line-clamp-2 w-full text-left [&>mark]:bg-yellow-200 [&>mark]:dark:bg-yellow-800 [&>mark]:px-0.5 [&>mark]:rounded-sm"
        dangerouslySetInnerHTML={{ __html: result.snippet || result.text || "[No content]" }}
      />

      {/* Attachment indicator */}
      {result.hasAttachment && !result.text && (
        <span className="text-xs text-muted-foreground italic">[Attachment]</span>
      )}
    </SidebarMenuButton>
  );
});
