import { useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
} from '@/components/ui/sidebar';
import { ConversationList } from '@/components/conversation-list';
import { MessageThread } from '@/components/message-thread';
import type { Conversation } from '@/types';

// Main application layout with sidebar and message panel.
export function AppLayout() {
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  return (
    <SidebarProvider defaultOpen>
      {/* Left sidebar with conversation list - fixed position */}
      <Sidebar className="border-r">
        <SidebarHeader className="border-b px-6 py-3">
          <h1 className="font-semibold text-lg pt-(--spacing-header)">
            Messages
          </h1>
        </SidebarHeader>
        <SidebarContent>
          <ConversationList
            selectedId={selectedConversation?.rowid ?? null}
            onSelect={setSelectedConversation}
          />
        </SidebarContent>
      </Sidebar>

      {/* Right panel with message thread */}
      <SidebarInset>
        <MessageThread conversation={selectedConversation} />
      </SidebarInset>
    </SidebarProvider>
  );
}
