import { ipcMain } from "electron";
import Database from "better-sqlite3";
import { SearchIndexService } from "./service";
import { SearchOptions } from "./types";
import { getAllHandles, getAllChats } from "../conversations/queries";

let searchService: SearchIndexService | null = null;
let chatDb: Database.Database | null = null;

// Initialize search service with dependencies.
export function initializeSearchService(
  service: SearchIndexService,
  db: Database.Database
): void {
  searchService = service;
  chatDb = db;
}

// Register search-related IPC handlers.
export function registerSearchHandlers(): void {
  // Search messages
  ipcMain.handle("search:query", async (_event, options: SearchOptions) => {
    if (!searchService) throw new Error("Search index not initialized");
    return searchService.search(options);
  });

  // Get search index status
  ipcMain.handle("search:status", async () => {
    if (!searchService)
      return { indexed: false, messageCount: 0, lastSyncTime: null, chatDbPath: null };
    return searchService.getIndexStatus();
  });

  // Rebuild search index
  ipcMain.handle("search:rebuild", async () => {
    if (!searchService || !chatDb) throw new Error("Services not initialized");
    return searchService.buildIndex(chatDb);
  });

  // Get all handles for sender autocomplete
  ipcMain.handle("search:get-handles", async () => {
    return getAllHandles();
  });

  // Get all chats for filter dropdown
  ipcMain.handle("search:get-chats", async () => {
    return getAllChats();
  });
}
