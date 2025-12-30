import * as path from "path";

// Resolve database path - always uses project data directory.
export function getDatabasePath(): string {
  return path.join(__dirname, "..", "..", "data", "chat.db");
}

// Resolve search index path - always uses project data directory.
export function getSearchIndexPath(): string {
  return path.join(__dirname, "..", "..", "data", "search-index.db");
}
