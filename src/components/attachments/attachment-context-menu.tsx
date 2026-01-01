import { memo, useCallback, useState, type ReactNode } from 'react';
import { Download, Folder, Share, Info, MessageSquare } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { AttachmentInfoSheet } from './attachment-info-sheet';
import type { Attachment } from '@/types';
import { getDisplayName } from '@/lib/attachments';

type AttachmentContextMenuProps = {
  attachment: Attachment;
  children: ReactNode;
  // Optional props for "Find in Chat" navigation (used in gallery view)
  chatId?: number;
  messageId?: number;
  onFindInChat?: (chatId: number, messageId: number) => void;
};

export const AttachmentContextMenu = memo(function AttachmentContextMenu({
  attachment,
  children,
  chatId,
  messageId,
  onFindInChat,
}: AttachmentContextMenuProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const handleFindInChat = useCallback(() => {
    if (chatId && messageId && onFindInChat) {
      onFindInChat(chatId, messageId);
    }
  }, [chatId, messageId, onFindInChat]);

  const handleDownload = useCallback(async () => {
    if (!attachment.localPath) return;

    try {
      const result = await window.electronAPI.downloadAttachment({
        localPath: attachment.localPath,
        suggestedFilename: getDisplayName(attachment),
      });

      if (!result.success && !result.canceled && result.error) {
        console.error('Download failed:', result.error);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  }, [attachment]);

  const handleShowInFinder = useCallback(async () => {
    if (!attachment.localPath) return;

    try {
      const result = await window.electronAPI.showInFinder(attachment.localPath);
      if (!result.success && result.error) {
        console.error('Show in Finder failed:', result.error);
      }
    } catch (error) {
      console.error('Show in Finder error:', error);
    }
  }, [attachment.localPath]);

  const handleShare = useCallback(async () => {
    if (!attachment.localPath) return;

    try {
      const result = await window.electronAPI.shareAttachment(attachment.localPath);
      if (!result.success && result.error) {
        console.error('Share failed:', result.error);
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [attachment.localPath]);

  // Don't render context menu if attachment has no local path
  if (!attachment.localPath) {
    return <>{children}</>;
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleDownload}>
            <Download className="size-4" />
            Save As...
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleShowInFinder}>
            <Folder className="size-4" />
            Show in Finder
          </ContextMenuItem>
          <ContextMenuItem onClick={handleShare}>
            <Share className="size-4" />
            Share
          </ContextMenuItem>
          {chatId && messageId && onFindInChat && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleFindInChat}>
                <MessageSquare className="size-4" />
                Find in Chat
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setIsInfoOpen(true)}>
            <Info className="size-4" />
            More Info
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AttachmentInfoSheet
        attachment={attachment}
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </>
  );
});
