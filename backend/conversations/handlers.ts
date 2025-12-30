import { ipcMain } from "electron";
import { getConversations, getConversationById } from "./queries";
import { ConversationsOptions } from "./types";

// Register conversation-related IPC handlers.
export function registerConversationHandlers(): void {
  // Fetch paginated conversation list
  ipcMain.handle(
    "db:get-conversations",
    async (_event, options: ConversationsOptions) => {
      return getConversations(options);
    }
  );

  // Fetch single conversation by ID
  ipcMain.handle(
    "db:get-conversation-by-id",
    async (_event, { chatId }: { chatId: number }) => {
      return getConversationById(chatId);
    }
  );
}
