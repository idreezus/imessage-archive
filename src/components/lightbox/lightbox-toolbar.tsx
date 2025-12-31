import { memo } from 'react';
import { Download, Share, FolderOpen, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Attachment } from '@/types';
import { useAttachmentActions } from '@/hooks/use-attachment-actions';

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
  const { download, share, showInFinder, isDownloading, isSharing } =
    useAttachmentActions(attachment);

  if (!attachment.localPath) return null;

  return (
    <div
      className="flex justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <ButtonGroup className="bg-black/60 backdrop-blur-sm rounded-xl p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={download}
              disabled={isDownloading}
              aria-label="Download"
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <Download className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={share}
              disabled={isSharing}
              aria-label="Share"
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <Share className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={showInFinder}
              aria-label="Show in Finder"
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <FolderOpen className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show in Finder</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent>Info</TooltipContent>
        </Tooltip>
      </ButtonGroup>
    </div>
  );
});
