import { isDatabaseOpen } from "../database/connection";
import { getDatabasePath } from "../shared/paths";
import {
  getMessages,
  getMessagesAroundDate,
  getMessagesAround,
  getDateIndex,
} from "./queries";
import { MessagesOptions, GetMessagesAroundOptions } from "./types";
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

  // Unified navigation API - supports date, rowId, and monthKey targets
  handleWithTiming(
    "db:get-messages-around",
    async (_event, options: GetMessagesAroundOptions) => {
      return getMessagesAround(options);
    }
  );

  // Deprecated: Get messages around a specific date (for scroll-to navigation)
  // Delegates to unified API for consistency. Will be removed after frontend migration.
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
      const result = getMessagesAround({
        chatId,
        target: { type: "date", date: targetDate },
        contextCount,
      });
      // Return old format for backwards compatibility
      return { messages: result.messages, targetIndex: result.targetIndex };
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
