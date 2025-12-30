import { memo } from 'react';
import type { Handle } from '@/types';

type MessageSenderProps = {
  senderHandle: Handle;
};

// Sender name displayed for received messages in group chats.
export const MessageSender = memo(function MessageSender({
  senderHandle,
}: MessageSenderProps) {
  return (
    <p className="text-xs text-muted-foreground font-mono mb-1 ml-3">
      {senderHandle.id}
    </p>
  );
});
