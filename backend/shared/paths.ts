import { app } from "electron";
import * as path from "path";

// Resolve database path based on environment.
export function getDatabasePath(): string {
  if (app.isPackaged) {
    // Production: actual iMessage database location
    return path.join(app.getPath("home"), "Library/Messages/chat.db");
  }
  // Development: local copy in data directory
  return path.join(__dirname, "..", "..", "data", "chat.db");
}

// Resolve search index path.
export function getSearchIndexPath(): string {
  if (app.isPackaged) {
    // Production: store in app data directory
    return path.join(app.getPath("userData"), "search-index.db");
  }
  // Development: store alongside data directory
  return path.join(__dirname, "..", "..", "data", "search-index.db");
}
