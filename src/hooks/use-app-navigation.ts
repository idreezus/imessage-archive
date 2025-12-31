import { useState, useCallback, useEffect } from 'react';
import { useGalleryContext } from '@/components/gallery';
import type { Conversation } from '@/types';
import type { SearchResultItem } from '@/types/search';

type UseAppNavigationReturn = {
  selectedConversation: Conversation | null;
  setSelectedConversation: (conversation: Conversation | null) => void;
  targetMessageRowid: number | null;
  handleSearchResultClick: (result: SearchResultItem) => Promise<void>;
  handleMessageScrollComplete: () => void;
};

export function useAppNavigation(): UseAppNavigationReturn {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [targetMessageRowid, setTargetMessageRowid] = useState<number | null>(
    null
  );

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

  return {
    selectedConversation,
    setSelectedConversation,
    targetMessageRowid,
    handleSearchResultClick,
    handleMessageScrollComplete,
  };
}
