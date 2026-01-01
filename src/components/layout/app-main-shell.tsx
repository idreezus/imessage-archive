import { SidebarInset } from '@/components/ui/sidebar';
import { MessageThread } from '@/components/messages/message-thread';
import { GalleryView } from '@/components/gallery';
import type { Conversation } from '@/types';
import type { NavigationTarget } from '@/types/navigation';

type GalleryConfig = {
  chatId: number | null;
  chatDisplayName: string | null;
};

type AppMainShellProps = {
  conversation: Conversation | null;
  navigationTarget: NavigationTarget | null;
  onNavigationComplete: () => void;
  onFindInChat: (chatId: number, messageId: number) => void;
  // Gallery props
  isGalleryOpen: boolean;
  galleryConfig: GalleryConfig | null;
  onCloseGallery: () => void;
  onOpenGallery: (chatId?: number, chatName?: string) => void;
};

export function AppMainShell({
  conversation,
  navigationTarget,
  onNavigationComplete,
  onFindInChat,
  isGalleryOpen,
  galleryConfig,
  onCloseGallery,
  onOpenGallery,
}: AppMainShellProps) {
  return (
    <SidebarInset>
      {isGalleryOpen && galleryConfig ? (
        <GalleryView
          chatId={galleryConfig.chatId}
          chatDisplayName={galleryConfig.chatDisplayName}
          onClose={onCloseGallery}
          onFindInChat={onFindInChat}
        />
      ) : (
        <MessageThread
          conversation={conversation}
          navigationTarget={navigationTarget}
          onNavigationComplete={onNavigationComplete}
          onOpenGallery={(chatId, chatName) => onOpenGallery(chatId, chatName)}
        />
      )}
    </SidebarInset>
  );
}
