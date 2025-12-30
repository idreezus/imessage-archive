import { getConversations, getConversationById } from "./queries";
import { ConversationsOptions } from "./types";
import { handleWithTiming } from "../perf";

// Register conversation-related IPC handlers.
export function registerConversationHandlers(): void {
  // Fetch paginated conversation list
  handleWithTiming(
    "db:get-conversations",
    async (_event, options: ConversationsOptions) => {
      return getConversations(options);
    }
  );

  // Fetch single conversation by ID
  handleWithTiming(
    "db:get-conversation-by-id",
    async (_event, { chatId }: { chatId: number }) => {
      return getConversationById(chatId);
    }
  );
}
