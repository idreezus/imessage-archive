import { useState, useCallback } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
} from '@/components/ui/sidebar';
import { ConversationList } from '@/components/conversation-list';
import { MessageThread } from '@/components/messages/components/message-thread';
import {
  SearchProvider,
  SearchContainer,
  SearchResultsPanel,
  useSearchContext,
} from '@/components/search';
import type { Conversation } from '@/types';
import type { SearchResultItem } from '@/types/search';

// Inner layout component that uses the search context
function AppLayoutInner() {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [targetMessageRowid, setTargetMessageRowid] = useState<number | null>(
    null
  );

  const search = useSearchContext();

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
          <h1 className="font-semibold text-lg pt-(--spacing-header)">
            Messages
          </h1>
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

      {/* Right panel with message thread */}
      <SidebarInset>
        <MessageThread
          conversation={selectedConversation}
          targetMessageRowid={targetMessageRowid}
          onScrollComplete={handleMessageScrollComplete}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}

// Main application layout with sidebar and message panel.
export function AppLayout() {
  return (
    <SearchProvider>
      <AppLayoutInner />
    </SearchProvider>
  );
}
