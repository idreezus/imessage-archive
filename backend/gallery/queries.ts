import { getDatabaseInstance } from "../database/connection";
import {
  appleToJsTimestamp,
  jsToAppleTimestamp,
} from "../database/timestamps";
import {
  classifyAttachmentType,
  resolveAttachmentPath,
} from "../attachments/queries";
import { startTimer } from "../perf";
import type {
  GalleryQueryOptions,
  GalleryAttachment,
  GalleryResponse,
  GalleryStats,
  GalleryStatsOptions,
  GalleryAttachmentRow,
  AttachmentMetadata,
} from "./types";

const DEFAULT_LIMIT = 50;

// Build WHERE clause and params for gallery queries
function buildWhereClause(
  options: GalleryQueryOptions | GalleryStatsOptions
): { where: string; params: (string | number)[] } {
  const conditions: string[] = [
    "a.hide_attachment = 0",
    "a.transfer_state IN (0, 5)",
  ];
  const params: (string | number)[] = [];

  // Chat filter
  if (options.chatId !== undefined) {
    conditions.push("cmj.chat_id = ?");
    params.push(options.chatId);
  }

  // Direction filter
  if (options.direction === "sent") {
    conditions.push("m.is_from_me = 1");
  } else if (options.direction === "received") {
    conditions.push("m.is_from_me = 0");
  }

  // Date range filter
  if (options.dateFrom !== undefined) {
    const appleFrom = jsToAppleTimestamp(options.dateFrom);
    conditions.push("cmj.message_date >= ?");
    params.push(appleFrom);
  }
  if (options.dateTo !== undefined) {
    const appleTo = jsToAppleTimestamp(options.dateTo);
    conditions.push("cmj.message_date <= ?");
    params.push(appleTo);
  }

  // Type filter - we filter in JS after classification
  // because type classification is complex (stickers, voice memos, etc.)

  return {
    where: conditions.join(" AND "),
    params,
  };
}

// Build ORDER BY clause
function buildOrderByClause(options: GalleryQueryOptions): string {
  const order = options.sortOrder === "asc" ? "ASC" : "DESC";

  switch (options.sortBy) {
    case "size":
      return `ORDER BY a.total_bytes ${order}, cmj.message_date DESC`;
    case "type":
      return `ORDER BY a.uti ${order}, cmj.message_date DESC`;
    case "date":
    default:
      return `ORDER BY cmj.message_date ${order}`;
  }
}

// Transform database row to GalleryAttachment
function rowToGalleryAttachment(row: GalleryAttachmentRow): GalleryAttachment {
  const jsDate = appleToJsTimestamp(row.messageDate);
  const date = new Date(jsDate);

  return {
    rowid: row.rowid,
    guid: row.guid,
    filename: row.filename,
    mimeType: row.mimeType,
    uti: row.uti,
    transferName: row.transferName,
    totalBytes: row.totalBytes,
    localPath: resolveAttachmentPath(row.filename),
    type: classifyAttachmentType({
      rowid: row.rowid,
      guid: row.guid,
      filename: row.filename,
      mimeType: row.mimeType,
      uti: row.uti,
      transferName: row.transferName,
      totalBytes: row.totalBytes,
      isSticker: row.isSticker,
      transferState: 0,
      isAudioMessage: row.isAudioMessage,
      messageId: 0,
    }),
    date: jsDate,
    isFromMe: row.isFromMe === 1,
    chatId: row.chatId,
    chatDisplayName: row.chatDisplayName,
    monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
  };
}

// Check if attachment type matches filter
function matchesTypeFilter(
  attachment: GalleryAttachment,
  types?: string[]
): boolean {
  if (!types || types.length === 0) return true;

  // Map filter types to actual attachment types
  for (const filterType of types) {
    switch (filterType) {
      case "image":
        if (attachment.type === "image" || attachment.type === "sticker")
          return true;
        break;
      case "video":
        if (attachment.type === "video") return true;
        break;
      case "audio":
        if (attachment.type === "audio" || attachment.type === "voice-memo")
          return true;
        break;
      case "document":
        if (attachment.type === "document" || attachment.type === "other")
          return true;
        break;
    }
  }
  return false;
}

// Get attachments for gallery view with filtering and pagination
// NOTE: Stats are fetched separately via gallery:get-stats for parallel loading
export function getGalleryAttachments(
  options: GalleryQueryOptions
): GalleryResponse {
  const timer = startTimer("db", "getGalleryAttachments");
  const db = getDatabaseInstance();

  const limit = options.limit ?? DEFAULT_LIMIT;
  const offset = options.offset ?? 0;
  const { where, params } = buildWhereClause(options);
  const orderBy = buildOrderByClause(options);

  // Fetch more than needed to account for type filtering in JS
  // We'll filter and return exactly `limit` items
  const fetchMultiplier = options.types?.length ? 3 : 1;
  const fetchLimit = limit * fetchMultiplier + 1; // +1 to check hasMore

  const query = `
    SELECT
      a.ROWID as rowid,
      a.guid,
      a.filename,
      a.mime_type as mimeType,
      a.uti,
      a.transfer_name as transferName,
      a.total_bytes as totalBytes,
      a.is_sticker as isSticker,
      m.is_audio_message as isAudioMessage,
      cmj.message_date as messageDate,
      m.is_from_me as isFromMe,
      cmj.chat_id as chatId,
      c.display_name as chatDisplayName
    FROM attachment a
    JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
    JOIN message m ON maj.message_id = m.ROWID
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const rows = db
    .prepare(query)
    .all(...params, fetchLimit, offset) as GalleryAttachmentRow[];

  // Transform and filter by type
  let attachments = rows.map(rowToGalleryAttachment);

  if (options.types?.length) {
    attachments = attachments.filter((a) =>
      matchesTypeFilter(a, options.types)
    );
  }

  // Check if we have more
  const hasMore = attachments.length > limit;

  // Trim to limit
  attachments = attachments.slice(0, limit);

  timer.end({ count: attachments.length, hasMore });

  // Return without stats - frontend fetches stats separately for parallel loading
  return {
    attachments,
    total: 0, // Will be updated by stats fetch
    hasMore,
    stats: null, // Stats fetched separately
  };
}

// Stats cache with TTL (5 seconds)
const STATS_CACHE_TTL = 5000;
const statsCache = new Map<string, { stats: GalleryStats; timestamp: number }>();

// Generate cache key from options
function getStatsCacheKey(options: GalleryStatsOptions): string {
  return JSON.stringify({
    chatId: options.chatId,
    direction: options.direction,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  });
}

// Get gallery stats for header display (with caching)
export function getGalleryStats(options: GalleryStatsOptions): GalleryStats {
  // Check cache first
  const cacheKey = getStatsCacheKey(options);
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
    return cached.stats;
  }

  const timer = startTimer("db", "getGalleryStats");
  const db = getDatabaseInstance();

  const { where, params } = buildWhereClause(options);

  // Query all matching attachments and classify in JS
  const query = `
    SELECT
      a.ROWID as rowid,
      a.guid,
      a.filename,
      a.mime_type as mimeType,
      a.uti,
      a.transfer_name as transferName,
      a.total_bytes as totalBytes,
      a.is_sticker as isSticker,
      m.is_audio_message as isAudioMessage,
      cmj.message_date as messageDate,
      m.is_from_me as isFromMe,
      cmj.chat_id as chatId,
      c.display_name as chatDisplayName
    FROM attachment a
    JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
    JOIN message m ON maj.message_id = m.ROWID
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE ${where}
  `;

  const rows = db.prepare(query).all(...params) as GalleryAttachmentRow[];

  const stats: GalleryStats = {
    photos: 0,
    videos: 0,
    audio: 0,
    files: 0,
    total: 0,
  };

  for (const row of rows) {
    const attachment = rowToGalleryAttachment(row);
    stats.total++;

    switch (attachment.type) {
      case "image":
      case "sticker":
        stats.photos++;
        break;
      case "video":
        stats.videos++;
        break;
      case "audio":
      case "voice-memo":
        stats.audio++;
        break;
      case "document":
      case "other":
        stats.files++;
        break;
    }
  }

  // Cache the result
  statsCache.set(cacheKey, { stats, timestamp: Date.now() });

  // Limit cache size (keep most recent 20 entries)
  if (statsCache.size > 20) {
    const oldestKey = statsCache.keys().next().value;
    if (oldestKey) {
      statsCache.delete(oldestKey);
    }
  }

  timer.end({ total: stats.total, cached: false });

  return stats;
}

// Get full metadata for a single attachment (for info panel)
export function getAttachmentMetadata(
  rowid: number
): AttachmentMetadata | null {
  const timer = startTimer("db", "getAttachmentMetadata");
  const db = getDatabaseInstance();

  const query = `
    SELECT
      a.ROWID as rowid,
      a.guid,
      a.filename,
      a.mime_type as mimeType,
      a.uti,
      a.transfer_name as transferName,
      a.total_bytes as totalBytes,
      a.created_date as createdDate,
      a.is_sticker as isSticker,
      m.is_audio_message as isAudioMessage,
      cmj.message_date as messageDate,
      m.is_from_me as isFromMe,
      h.id as senderHandle,
      c.display_name as chatDisplayName
    FROM attachment a
    JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
    JOIN message m ON maj.message_id = m.ROWID
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    WHERE a.ROWID = ?
    LIMIT 1
  `;

  const row = db.prepare(query).get(rowid) as
    | (GalleryAttachmentRow & { createdDate: number | null })
    | undefined;

  timer.end({ found: !!row });

  if (!row) return null;

  const localPath = resolveAttachmentPath(row.filename);

  return {
    rowid: row.rowid,
    filename: row.filename,
    mimeType: row.mimeType,
    uti: row.uti,
    totalBytes: row.totalBytes,
    transferName: row.transferName,
    createdDate: row.createdDate
      ? appleToJsTimestamp(row.createdDate)
      : null,
    messageDate: appleToJsTimestamp(row.messageDate),
    isFromMe: row.isFromMe === 1,
    senderHandle: row.senderHandle,
    chatDisplayName: row.chatDisplayName,
    absolutePath: localPath
      ? require("path").join(
          process.cwd(),
          "data",
          "attachments",
          localPath
        )
      : null,
  };
}
