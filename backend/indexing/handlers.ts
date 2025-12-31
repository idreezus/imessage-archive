// IPC handlers for media indexing

import { handleWithTiming } from "../perf";
import {
  getUnindexedCount,
  startIndexing,
  isIndexingInProgress,
  getCurrentProgress,
} from "./service";

export function registerIndexingHandlers(): void {
  // Get count of unindexed attachments
  handleWithTiming("indexing:get-unindexed-count", async () => {
    return getUnindexedCount();
  });

  // Start the indexing process
  handleWithTiming("indexing:start", async () => {
    return startIndexing();
  });

  // Check if indexing is in progress
  handleWithTiming("indexing:is-in-progress", async () => {
    return isIndexingInProgress();
  });

  // Get current progress (for reconnecting clients)
  handleWithTiming("indexing:get-progress", async () => {
    return getCurrentProgress();
  });
}
