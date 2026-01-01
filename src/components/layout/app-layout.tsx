import { SidebarProvider } from '@/components/ui/sidebar';
import { SearchProvider } from '@/components/search';
import { GalleryProvider } from '@/components/gallery';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { AppSidebar } from './app-sidebar';
import { AppMainShell } from './app-main-shell';

function AppLayoutInner() {
  const {
    selectedConversation,
    setSelectedConversation,
    navigationTarget,
    handleSearchResultClick,
    handleNavigationComplete,
  } = useAppNavigation();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        selectedId={selectedConversation?.rowid ?? null}
        onSelectConversation={setSelectedConversation}
        onSearchResultClick={handleSearchResultClick}
      />
      <AppMainShell
        conversation={selectedConversation}
        navigationTarget={navigationTarget}
        onNavigationComplete={handleNavigationComplete}
      />
    </SidebarProvider>
  );
}

export function AppLayout() {
  return (
    <SearchProvider>
      <GalleryProvider>
        <AppLayoutInner />
      </GalleryProvider>
    </SearchProvider>
  );
}
