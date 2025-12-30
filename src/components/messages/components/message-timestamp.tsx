import { memo } from 'react';
import { formatDate, formatTime } from '../utils';

type MessageTimestampProps = {
  timestamp: number;
};

// Timestamp divider shown between messages with time gaps.
export const MessageTimestamp = memo(function MessageTimestamp({
  timestamp,
}: MessageTimestampProps) {
  return (
    <div className="flex justify-center py-2">
      <span className="text-xs text-muted-foreground font-mono">
        {formatDate(timestamp)} {formatTime(timestamp)}
      </span>
    </div>
  );
});
