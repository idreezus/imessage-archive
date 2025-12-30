import { app } from "electron";
import * as path from "path";

// Resolve attachments base path.
export function getAttachmentsBasePath(): string {
  if (app.isPackaged) {
    // Production: actual iMessage attachments location
    return path.join(app.getPath("home"), "Library/Messages/Attachments");
  }
  // Development: local copy in data directory
  return path.join(__dirname, "..", "..", "data", "attachments");
}
