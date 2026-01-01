import { SidebarInset } from '@/components/ui/sidebar';
import { MessageThread } from '@/components/messages/message-thread';
import { GalleryView, useGalleryContext } from '@/components/gallery';
import type { Conversation } from '@/types';
import type { NavigationTarget } from '@/types/navigation';

type AppMainShellProps = {
  conversation: Conversation | null;
  navigationTarget: NavigationTarget | null;
  onNavigationComplete: () => void;
  onFindInChat: (chatId: number, messageId: number) => void;
};

export function AppMainShell({
  conversation,
  navigationTarget,
  onNavigationComplete,
  onFindInChat,
}: AppMainShellProps) {
  const gallery = useGalleryContext();

  return (
    <SidebarInset>
      {gallery.isGalleryOpen ? (
        <GalleryView onFindInChat={onFindInChat} />
      ) : (
        <MessageThread
          conversation={conversation}
          navigationTarget={navigationTarget}
          onNavigationComplete={onNavigationComplete}
          onOpenGallery={(chatId, chatName) =>
            gallery.openGallery(chatId, chatName)
          }
        />
      )}
    </SidebarInset>
  );
}
