import { memo, useCallback, type ReactNode } from 'react';
import { Copy, AlertTriangle, Check, CheckCheck } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Message } from '@/types';
import { getEffectName, formatMessageDateTime, formatMessageTime } from '@/lib/messages';

type MessageContextMenuProps = {
  message: Message;
  children: ReactNode;
};

export const MessageContextMenu = memo(function MessageContextMenu({
  message,
  children,
}: MessageContextMenuProps) {
  const handleCopyText = useCallback(() => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
    }
  }, [message.text]);

  const handleCopyRawData = useCallback(() => {
    const rawData = JSON.stringify(message, null, 2);
    navigator.clipboard.writeText(rawData);
  }, [message]);

  const effectName = getEffectName(message.expressiveSendStyleId);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Info Section */}
        <ContextMenuLabel>Message Info</ContextMenuLabel>

        {/* Sent timestamp */}
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Sent:</span>{' '}
          {formatMessageDateTime(message.date)}
        </div>

        {/* Delivered timestamp (only for sent messages) */}
        {message.isFromMe && message.dateDelivered && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">Delivered:</span>{' '}
            {formatMessageTime(message.dateDelivered)}
            <Check className="size-3.5 text-muted-foreground" />
          </div>
        )}

        {/* Read timestamp (only for sent messages) */}
        {message.isFromMe && message.dateRead && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">Read:</span>{' '}
            {formatMessageTime(message.dateRead)}
            <CheckCheck className="size-3.5 text-blue-500" />
          </div>
        )}

        {/* Service */}
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Service:</span>{' '}
          {message.service}
        </div>

        {/* Effect (if present) */}
        {effectName && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Effect:</span>{' '}
            {effectName}
          </div>
        )}

        {/* Edited timestamp */}
        {message.dateEdited && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Edited:</span>{' '}
            {formatMessageTime(message.dateEdited)}
          </div>
        )}

        {/* Forwarded flag */}
        {message.isForward && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Forwarded message
          </div>
        )}

        {/* Downgraded warning */}
        {message.wasDowngraded && (
          <div className="px-2 py-1.5 text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle className="size-3.5" />
            Downgraded to SMS
          </div>
        )}

        {/* Retracted/unsent notice */}
        {message.dateRetracted && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Unsent:</span>{' '}
            {formatMessageTime(message.dateRetracted)}
          </div>
        )}

        <ContextMenuSeparator />

        {/* Actions Section */}
        <ContextMenuItem
          onClick={handleCopyText}
          disabled={!message.text}
        >
          <Copy className="size-4" />
          Copy Text
        </ContextMenuItem>

        <ContextMenuItem onClick={handleCopyRawData}>
          <Copy className="size-4" />
          Copy Raw Data
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
