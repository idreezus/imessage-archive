import { isDatabaseOpen } from "../database/connection";
import { getDatabasePath } from "../shared/paths";
import { getMessages, getMessagesAroundDate, getDateIndex } from "./queries";
import { MessagesOptions } from "./types";
import { handleWithTiming } from "../perf";

// Register message-related IPC handlers.
export function registerMessageHandlers(): void {
  // Fetch messages for a specific conversation
  handleWithTiming(
    "db:get-messages",
    async (_event, options: MessagesOptions) => {
      return getMessages(options);
    }
  );

  // Get database connection status
  handleWithTiming("db:get-status", () => {
    return {
      connected: isDatabaseOpen(),
      path: getDatabasePath(),
    };
  });

  // Get messages around a specific date (for scroll-to navigation)
  handleWithTiming(
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

  // Get date index for timeline scrubber navigation
  handleWithTiming(
    "db:get-date-index",
    async (_event, { chatId }: { chatId: number }) => {
      return getDateIndex(chatId);
    }
  );
}
