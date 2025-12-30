import { memo, useCallback, useState } from 'react';
import { Download, Share, Folder, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import type { Attachment } from '@/types';
import { getDisplayName } from '@/lib/attachments';

type LightboxToolbarProps = {
  attachment: Attachment;
  onToggleInfo: () => void;
  isInfoOpen: boolean;
};

export const LightboxToolbar = memo(function LightboxToolbar({
  attachment,
  onToggleInfo,
  isInfoOpen,
}: LightboxToolbarProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!attachment.localPath) return;

    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  }, [attachment]);

  const handleShare = useCallback(async () => {
    if (!attachment.localPath) return;

    setIsSharing(true);
    try {
      const result = await window.electronAPI.shareAttachment(attachment.localPath);
      if (!result.success && result.error) {
        console.error('Share failed:', result.error);
      }
    } catch (error) {
      console.error('Share error:', error);
    } finally {
      setIsSharing(false);
    }
  }, [attachment.localPath]);

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

  if (!attachment.localPath) return null;

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20"
      onClick={(e) => e.stopPropagation()}
    >
      <ButtonGroup className="bg-black/60 backdrop-blur-sm rounded-xl p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label="Download"
          className="text-white hover:bg-white/20 hover:text-white"
        >
          <Download className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleShare}
          disabled={isSharing}
          aria-label="Share"
          className="text-white hover:bg-white/20 hover:text-white"
        >
          <Share className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleShowInFinder}
          aria-label="Show in Finder"
          className="text-white hover:bg-white/20 hover:text-white"
        >
          <Folder className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleInfo}
          aria-label="File info"
          className={`text-white hover:bg-white/20 hover:text-white ${
            isInfoOpen ? 'bg-white/20' : ''
          }`}
        >
          <Info className="size-5" />
        </Button>
      </ButtonGroup>
    </div>
  );
});
