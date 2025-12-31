import { useState, useCallback, useEffect } from 'react';
import { Images } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ConversationList } from '@/components/conversations/conversation-list';
import { MessageThread } from '@/components/messages/message-thread';
import {
  SearchProvider,
  SearchContainer,
  SearchResultsPanel,
  useSearchContext,
} from '@/components/search';
import {
  GalleryProvider,
  GalleryView,
  useGalleryContext,
} from '@/components/gallery';
import type { Conversation } from '@/types';
import type { SearchResultItem } from '@/types/search';

// Inner layout component that uses the search and gallery context
function AppLayoutInner() {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [targetMessageRowid, setTargetMessageRowid] = useState<number | null>(
    null
  );

  const search = useSearchContext();
  const gallery = useGalleryContext();

  // Auto-close gallery when navigating to a different conversation
  useEffect(() => {
    if (gallery.isGalleryOpen && selectedConversation) {
      // If viewing a chat-specific gallery and switching to a different chat
      if (
        gallery.chatId !== null &&
        gallery.chatId !== selectedConversation.rowid
      ) {
        gallery.closeGallery();
      }
    }
  }, [
    selectedConversation?.rowid,
    gallery.isGalleryOpen,
    gallery.chatId,
    gallery.closeGallery,
  ]);

  // Handle clicking a search result
  const handleSearchResultClick = useCallback(
    async (result: SearchResultItem) => {
      try {
        // Load the conversation
        const conversation = await window.electronAPI.getConversationById(
          result.chatRowid
        );
        if (conversation) {
          setSelectedConversation(conversation);
          setTargetMessageRowid(result.messageRowid);
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    },
    []
  );

  // Clear target after navigation complete
  const handleMessageScrollComplete = useCallback(() => {
    setTargetMessageRowid(null);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      {/* Left sidebar with conversation list - fixed position */}
      <Sidebar className="border-r">
        <SidebarHeader className="border-b px-4 py-3 space-y-3">
          <div className="flex items-center justify-between pt-(--spacing-header)">
            <h1 className="font-semibold text-lg">Messages</h1>
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
            <SearchResultsPanel onResultClick={handleSearchResultClick} />
          ) : (
            <ConversationList
              selectedId={selectedConversation?.rowid ?? null}
              onSelect={setSelectedConversation}
            />
          )}
        </SidebarContent>
      </Sidebar>

      {/* Right panel with message thread or gallery */}
      <SidebarInset>
        {gallery.isGalleryOpen ? (
          <GalleryView />
        ) : (
          <MessageThread
            conversation={selectedConversation}
            targetMessageRowid={targetMessageRowid}
            onScrollComplete={handleMessageScrollComplete}
            onOpenGallery={(chatId, chatName) =>
              gallery.openGallery(chatId, chatName)
            }
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

// Main application layout with sidebar and message panel.
export function AppLayout() {
  return (
    <SearchProvider>
      <GalleryProvider>
        <AppLayoutInner />
      </GalleryProvider>
    </SearchProvider>
  );
}
