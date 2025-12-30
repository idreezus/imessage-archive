import * as path from "path";

// Resolve attachments base path - always uses project data directory.
export function getAttachmentsBasePath(): string {
  return path.join(__dirname, "..", "..", "data", "attachments");
}
