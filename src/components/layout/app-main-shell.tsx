import { SidebarInset } from '@/components/ui/sidebar';
import { MessageThread } from '@/components/messages/message-thread';
import { GalleryView, useGalleryContext } from '@/components/gallery';
import type { Conversation } from '@/types';

type AppMainShellProps = {
  conversation: Conversation | null;
  targetMessageRowid: number | null;
  onScrollComplete: () => void;
};

export function AppMainShell({
  conversation,
  targetMessageRowid,
  onScrollComplete,
}: AppMainShellProps) {
  const gallery = useGalleryContext();

  return (
    <SidebarInset>
      {gallery.isGalleryOpen ? (
        <GalleryView />
      ) : (
        <MessageThread
          conversation={conversation}
          targetMessageRowid={targetMessageRowid}
          onScrollComplete={onScrollComplete}
          onOpenGallery={(chatId, chatName) =>
            gallery.openGallery(chatId, chatName)
          }
        />
      )}
    </SidebarInset>
  );
}
