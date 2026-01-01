import { Images } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ConversationList } from '@/components/conversations';
import {
  SearchContainer,
  SearchResultsPanel,
  useSearchContext,
} from '@/components/search';
import { useGalleryContext } from '@/components/gallery';
import type { Conversation } from '@/types';
import type { SearchResultItem } from '@/types/search';

type AppSidebarProps = {
  selectedId: number | null;
  onSelectConversation: (conversation: Conversation | null) => void;
  onSearchResultClick: (result: SearchResultItem) => void;
};

export function AppSidebar({
  selectedId,
  onSelectConversation,
  onSearchResultClick,
}: AppSidebarProps) {
  const search = useSearchContext();
  const gallery = useGalleryContext();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between pt-sidebar-header">
          <h1 className="font-semibold text-lg">iMessage Archive</h1>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => gallery.openGallery()}
            aria-label="Open gallery"
          >
            <Images className="size-5" />
          </Button>
        </div>
        <SearchContainer />
      </SidebarHeader>
      <SidebarContent>
        {search.isSearchActive ? (
          <SearchResultsPanel onResultClick={onSearchResultClick} />
        ) : (
          <ConversationList
            selectedId={selectedId}
            onSelect={onSelectConversation}
          />
        )}
      </SidebarContent>
    </Sidebar>
  );
}
