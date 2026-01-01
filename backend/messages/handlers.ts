import { isDatabaseOpen } from "../database/connection";
import { getDatabasePath } from "../shared/paths";
import { getMessages, getMessagesAround, getDateIndex } from "./queries";
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

  // Get date index for timeline scrubber navigation
  handleWithTiming(
    "db:get-date-index",
    async (_event, { chatId }: { chatId: number }) => {
      return getDateIndex(chatId);
    }
  );
}
