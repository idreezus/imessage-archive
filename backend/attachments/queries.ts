import { getDatabaseInstance } from "../database/connection";
import { AttachmentRow, AttachmentType, Attachment } from "./types";

// Classify attachment type based on mime type, UTI, and flags.
export function classifyAttachmentType(row: AttachmentRow): AttachmentType {
  // Check special flags first
  if (row.isAudioMessage === 1) return "voice-memo";
  if (row.isSticker === 1) return "sticker";

  const mime = row.mimeType?.toLowerCase() || "";
  const uti = row.uti?.toLowerCase() || "";
  const filename = row.filename?.toLowerCase() || "";

  // Check for CAF voice memos (Core Audio Format - not browser playable)
  // These often have no mime_type but have UTI com.apple.coreaudio-format
  if (uti.includes("coreaudio") || filename.endsWith(".caf")) {
    return "voice-memo";
  }

  // Check MIME type
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";

  // Fallback to UTI
  if (
    uti.includes("image") ||
    uti.includes("jpeg") ||
    uti.includes("png") ||
    uti.includes("heic")
  )
    return "image";
  if (
    uti.includes("movie") ||
    uti.includes("video") ||
    uti.includes("quicktime")
  )
    return "video";
  if (uti.includes("audio") || uti.includes("m4a") || uti.includes("mp3"))
    return "audio";
  if (uti.includes("pdf")) return "document";

  return "other";
}

// Resolve database attachment path to local relative path.
// Database stores paths like: ~/Library/Messages/Attachments/XX/YY/at_Z_GUID/filename.ext
// We extract and use: data/attachments/XX/YY/at_Z_GUID/filename.ext (preserves at_ prefix)
export function resolveAttachmentPath(dbPath: string | null): string | null {
  if (!dbPath) return null;

  // Match the iMessage attachment path format and preserve the full folder name
  const match = dbPath.match(
    /~\/Library\/Messages\/Attachments\/([a-f0-9]{2})\/([a-f0-9]{2})\/(at_\d+_[A-F0-9-]+)\/(.+)$/i
  );

  if (match) {
    const [, dir1, dir2, folderName, filename] = match;
    return `${dir1}/${dir2}/${folderName}/${filename}`;
  }

  // Alternative: try to extract just the relative path from Attachments/
  const altMatch = dbPath.match(/Attachments\/(.+)$/i);
  if (altMatch) {
    return altMatch[1];
  }

  return null;
}

// Fetch attachments for a list of message IDs.
export function getAttachmentsForMessages(
  messageIds: number[]
): Map<number, Attachment[]> {
  if (messageIds.length === 0) return new Map();

  const db = getDatabaseInstance();
  const placeholders = messageIds.map(() => "?").join(",");
  const stmt = db.prepare(`
    SELECT
      a.ROWID as rowid,
      a.guid,
      a.filename,
      a.mime_type as mimeType,
      a.uti,
      a.transfer_name as transferName,
      a.total_bytes as totalBytes,
      a.is_sticker as isSticker,
      a.transfer_state as transferState,
      m.is_audio_message as isAudioMessage,
      maj.message_id as messageId
    FROM attachment a
    JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
    JOIN message m ON maj.message_id = m.ROWID
    WHERE maj.message_id IN (${placeholders})
      AND a.hide_attachment = 0
      AND a.transfer_state IN (0, 5)
    ORDER BY a.created_date ASC
  `);

  const rows = stmt.all(...messageIds) as AttachmentRow[];

  // Group by message ID and transform
  const result = new Map<number, Attachment[]>();

  for (const row of rows) {
    const attachment: Attachment = {
      rowid: row.rowid,
      guid: row.guid,
      filename: row.filename,
      mimeType: row.mimeType,
      uti: row.uti,
      transferName: row.transferName,
      totalBytes: row.totalBytes,
      isSticker: row.isSticker === 1,
      isAudioMessage: row.isAudioMessage === 1,
      localPath: resolveAttachmentPath(row.filename),
      type: classifyAttachmentType(row),
    };

    const existing = result.get(row.messageId);
    if (existing) {
      existing.push(attachment);
    } else {
      result.set(row.messageId, [attachment]);
    }
  }

  return result;
}
