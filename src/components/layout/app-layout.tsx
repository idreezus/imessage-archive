import { SidebarProvider } from '@/components/ui/sidebar';
import { SearchProvider } from '@/components/search';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { AppSidebar } from './app-sidebar';
import { AppMainShell } from './app-main-shell';

function AppLayoutInner() {
  const {
    selectedConversation,
    setSelectedConversation,
    navigationTarget,
    handleSearchResultClick,
    handleFindInChat,
    handleNavigationComplete,
    // Gallery state from hook
    isGalleryOpen,
    galleryConfig,
    openGallery,
    closeGallery,
  } = useAppNavigation();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        selectedId={selectedConversation?.rowid ?? null}
        onSelectConversation={setSelectedConversation}
        onSearchResultClick={handleSearchResultClick}
        onOpenGallery={() => openGallery()}
      />
      <AppMainShell
        conversation={selectedConversation}
        navigationTarget={navigationTarget}
        onNavigationComplete={handleNavigationComplete}
        onFindInChat={handleFindInChat}
        isGalleryOpen={isGalleryOpen}
        galleryConfig={galleryConfig}
        onCloseGallery={closeGallery}
        onOpenGallery={openGallery}
      />
    </SidebarProvider>
  );
}

export function AppLayout() {
  return (
    <SearchProvider>
      <AppLayoutInner />
    </SearchProvider>
  );
}
