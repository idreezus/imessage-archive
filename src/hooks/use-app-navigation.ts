import { useState, useCallback, useEffect } from 'react';
import type { Conversation } from '@/types';
import type { SearchResultItem } from '@/types/search';
import type { NavigationTarget } from '@/types/navigation';

type GalleryConfig = {
  chatId: number | null;
  chatDisplayName: string | null;
};

type UseAppNavigationReturn = {
  selectedConversation: Conversation | null;
  setSelectedConversation: (conversation: Conversation | null) => void;
  navigationTarget: NavigationTarget | null;
  handleSearchResultClick: (result: SearchResultItem) => Promise<void>;
  handleFindInChat: (chatId: number, messageId: number) => Promise<void>;
  handleNavigationComplete: () => void;
  // Gallery state
  isGalleryOpen: boolean;
  galleryConfig: GalleryConfig | null;
  openGallery: (chatId?: number, chatName?: string) => void;
  closeGallery: () => void;
};

export function useAppNavigation(): UseAppNavigationReturn {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [navigationTarget, setNavigationTarget] =
    useState<NavigationTarget | null>(null);

  // Gallery state
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryConfig, setGalleryConfig] = useState<GalleryConfig | null>(
    null
  );

  // Open gallery with optional chat context
  const openGallery = useCallback((chatId?: number, chatName?: string) => {
    setGalleryConfig({
      chatId: chatId ?? null,
      chatDisplayName: chatName ?? null,
    });
    setIsGalleryOpen(true);
  }, []);

  // Close gallery and reset config
  const closeGallery = useCallback(() => {
    setIsGalleryOpen(false);
    setGalleryConfig(null);
  }, []);

  // Auto-close gallery when navigating to a different conversation
  useEffect(() => {
    if (isGalleryOpen && selectedConversation && galleryConfig?.chatId !== null) {
      // If viewing a chat-specific gallery and switching to a different chat
      if (galleryConfig && galleryConfig.chatId !== selectedConversation.rowid) {
        closeGallery();
      }
    }
  }, [
    selectedConversation?.rowid,
    isGalleryOpen,
    galleryConfig?.chatId,
    closeGallery,
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
        closeGallery();

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
    [closeGallery, selectedConversation]
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
    // Gallery state
    isGalleryOpen,
    galleryConfig,
    openGallery,
    closeGallery,
  };
}
