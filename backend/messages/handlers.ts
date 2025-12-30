import { ipcMain } from "electron";
import { isDatabaseOpen } from "../database/connection";
import { getDatabasePath } from "../shared/paths";
import { getMessages, getMessagesAroundDate } from "./queries";
import { MessagesOptions } from "./types";

// Register message-related IPC handlers.
export function registerMessageHandlers(): void {
  // Fetch messages for a specific conversation
  ipcMain.handle(
    "db:get-messages",
    async (_event, options: MessagesOptions) => {
      return getMessages(options);
    }
  );

  // Get database connection status
  ipcMain.handle("db:get-status", () => {
    return {
      connected: isDatabaseOpen(),
      path: getDatabasePath(),
    };
  });

  // Get messages around a specific date (for scroll-to navigation)
  ipcMain.handle(
    "db:get-messages-around-date",
    async (
      _event,
      {
        chatId,
        targetDate,
        contextCount,
      }: { chatId: number; targetDate: number; contextCount?: number }
    ) => {
      return getMessagesAroundDate(chatId, targetDate, contextCount);
    }
  );
}
