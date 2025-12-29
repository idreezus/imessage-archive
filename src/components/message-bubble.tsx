import { cn } from '@/lib/utils';
import type { Message } from '@/types';

type MessageBubbleProps = {
  message: Message;
  showTimestamp: boolean;
  isGroupChat: boolean;
};

// Format timestamp as time string (e.g., "2:30 PM").
function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format timestamp as date string with relative terms.
function formatDate(timestamp: number): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Individual message bubble with styling based on sender and service.
export function MessageBubble({
  message,
  showTimestamp,
  isGroupChat,
}: MessageBubbleProps) {
  const isFromMe = message.isFromMe;

  return (
    <div className="space-y-1">
      {/* Timestamp divider for message gaps */}
      {showTimestamp && (
        <div className="flex justify-center py-2">
          <span className="text-xs text-muted-foreground font-mono">
            {formatDate(message.date)} {formatTime(message.date)}
          </span>
        </div>
      )}

      {/* Message bubble container */}
      <div className={cn('flex', isFromMe ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%]">
          {/* Sender name for received messages in group chats */}
          {!isFromMe && isGroupChat && message.senderHandle && (
            <p className="text-xs text-muted-foreground font-mono mb-1 ml-3">
              {message.senderHandle.id}
            </p>
          )}

          {/* Message bubble with theme-based coloring */}
          <div
            className={cn(
              'px-4 py-2 rounded-2xl',
              isFromMe
                ? 'bg-primary text-primary-foreground' // Sent: darker theme color
                : 'bg-muted text-foreground' // Received: muted background
            )}
          >
            {message.text ? (
              <p className="whitespace-pre-wrap wrap-break-words">
                {message.text}
              </p>
            ) : (
              <p className="italic text-sm opacity-70">
                [Attachment or unsupported content]
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
