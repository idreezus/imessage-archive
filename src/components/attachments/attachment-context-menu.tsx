import { memo, useCallback, type ReactNode } from 'react';
import { Download, Folder, Share } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Attachment } from '@/types';
import { getDisplayName } from '@/lib/attachments';

type AttachmentContextMenuProps = {
  attachment: Attachment;
  children: ReactNode;
};

export const AttachmentContextMenu = memo(function AttachmentContextMenu({
  attachment,
  children,
}: AttachmentContextMenuProps) {
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
      </ContextMenuContent>
    </ContextMenu>
  );
});
