import { useState, useCallback, useEffect } from 'react';
import { useGalleryContext } from '@/components/gallery';
import type { Conversation } from '@/types';
import type { SearchResultItem } from '@/types/search';
import type { NavigationTarget } from '@/types/navigation';

type UseAppNavigationReturn = {
  selectedConversation: Conversation | null;
  setSelectedConversation: (conversation: Conversation | null) => void;
  navigationTarget: NavigationTarget | null;
  handleSearchResultClick: (result: SearchResultItem) => Promise<void>;
  handleFindInChat: (chatId: number, messageId: number) => Promise<void>;
  handleNavigationComplete: () => void;
};

export function useAppNavigation(): UseAppNavigationReturn {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [navigationTarget, setNavigationTarget] =
    useState<NavigationTarget | null>(null);

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

  // Handle clicking a search result - sets conversation and navigation target
  const handleSearchResultClick = useCallback(
    async (result: SearchResultItem) => {
      try {
        // Load the conversation
        const conversation = await window.electronAPI.getConversationById(
          result.chatRowid
        );
        if (conversation) {
          setSelectedConversation(conversation);
          // Use rowId target with fallbackDate from search result
          setNavigationTarget({
            type: 'rowId',
            rowId: result.messageRowid,
            fallbackDate: result.date,
          });
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    },
    []
  );

  // Handle "Find in Chat" from gallery - closes gallery and navigates to message
  const handleFindInChat = useCallback(
    async (chatId: number, messageId: number) => {
      try {
        // Close gallery first
        gallery.closeGallery();

        // Load conversation if different from current
        if (!selectedConversation || selectedConversation.rowid !== chatId) {
          const conversation =
            await window.electronAPI.getConversationById(chatId);
          if (conversation) {
            setSelectedConversation(conversation);
          }
        }

        // Set navigation target to the message
        setNavigationTarget({
          type: 'rowId',
          rowId: messageId,
        });
      } catch (error) {
        console.error('Failed to navigate to message:', error);
      }
    },
    [gallery, selectedConversation]
  );

  // Clear navigation target after navigation completes
  const handleNavigationComplete = useCallback(() => {
    setNavigationTarget(null);
  }, []);

  return {
    selectedConversation,
    setSelectedConversation,
    navigationTarget,
    handleSearchResultClick,
    handleFindInChat,
    handleNavigationComplete,
  };
}
