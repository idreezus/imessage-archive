import { useCallback, useState } from 'react';
import type { Attachment } from '@/types';
import { getDisplayName } from '@/lib/attachments';

type AttachmentActionsState = {
  isDownloading: boolean;
  isSharing: boolean;
};

type AttachmentActions = {
  download: () => Promise<void>;
  share: () => Promise<void>;
  showInFinder: () => Promise<void>;
  isDownloading: boolean;
  isSharing: boolean;
};

export function useAttachmentActions(
  attachment: Attachment | null
): AttachmentActions {
  const [state, setState] = useState<AttachmentActionsState>({
    isDownloading: false,
    isSharing: false,
  });

  const download = useCallback(async () => {
    if (!attachment?.localPath) return;

    setState((s) => ({ ...s, isDownloading: true }));
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
      setState((s) => ({ ...s, isDownloading: false }));
    }
  }, [attachment]);

  const share = useCallback(async () => {
    if (!attachment?.localPath) return;

    setState((s) => ({ ...s, isSharing: true }));
    try {
      const result = await window.electronAPI.shareAttachment(
        attachment.localPath
      );
      if (!result.success && result.error) {
        console.error('Share failed:', result.error);
      }
    } catch (error) {
      console.error('Share error:', error);
    } finally {
      setState((s) => ({ ...s, isSharing: false }));
    }
  }, [attachment?.localPath]);

  const showInFinder = useCallback(async () => {
    if (!attachment?.localPath) return;

    try {
      const result = await window.electronAPI.showInFinder(
        attachment.localPath
      );
      if (!result.success && result.error) {
        console.error('Show in Finder failed:', result.error);
      }
    } catch (error) {
      console.error('Show in Finder error:', error);
    }
  }, [attachment?.localPath]);

  return {
    download,
    share,
    showInFinder,
    isDownloading: state.isDownloading,
    isSharing: state.isSharing,
  };
}
