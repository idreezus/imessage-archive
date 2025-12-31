// Background media indexing service
// Scans for unindexed image/video attachments and extracts dimensions

import { BrowserWindow } from "electron";
import * as path from "path";
import * as fs from "fs";
import { getDatabaseInstance } from "../database/connection";
import {
  getDimensions,
  setDimensions,
  saveDimensionsCache,
} from "../attachments/dimensions-cache";
import { getAttachmentsBasePath } from "../attachments/paths";
import {
  classifyAttachmentType,
  resolveAttachmentPath,
} from "../attachments/queries";
import {
  extractDimensionsInWorker,
  shutdownDimensionPool,
} from "../attachments/dimension-pool";
import type { AttachmentRow } from "../attachments/types";

export type IndexingProgress = {
  phase: "scanning" | "indexing" | "complete" | "error";
  processed: number;
  total: number;
  currentFile?: string;
  error?: string;
};

type MediaAttachment = {
  localPath: string;
  absolutePath: string;
  type: "image" | "video";
};

// Internal progress state
let isIndexing = false;
let currentProgress: IndexingProgress = {
  phase: "complete",
  processed: 0,
  total: 0,
};

// Batch size for processing
const BATCH_SIZE = 50;

// Query all image/video attachments from database
function getAllMediaAttachments(): MediaAttachment[] {
  const db = getDatabaseInstance();
  const basePath = getAttachmentsBasePath();

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
      0 as isAudioMessage,
      0 as messageId
    FROM attachment a
    WHERE a.hide_attachment = 0
      AND a.transfer_state IN (0, 5)
      AND a.filename IS NOT NULL
  `);

  const rows = stmt.all() as AttachmentRow[];
  const mediaAttachments: MediaAttachment[] = [];

  for (const row of rows) {
    const type = classifyAttachmentType(row);
    if (type !== "image" && type !== "video") continue;

    const localPath = resolveAttachmentPath(row.filename);
    if (!localPath) continue;

    const absolutePath = path.join(basePath, localPath);

    mediaAttachments.push({
      localPath,
      absolutePath,
      type,
    });
  }

  return mediaAttachments;
}

// Get attachments that are not yet in dimensions cache
export function getUnindexedAttachments(): MediaAttachment[] {
  const all = getAllMediaAttachments();
  return all.filter((a) => getDimensions(a.localPath) === null);
}

// Get count of unindexed attachments (fast check for UI)
export function getUnindexedCount(): number {
  return getUnindexedAttachments().length;
}

// Check if indexing is currently running
export function isIndexingInProgress(): boolean {
  return isIndexing;
}

// Get current progress
export function getCurrentProgress(): IndexingProgress {
  return currentProgress;
}

// Emit progress update to all renderer windows
function emitProgress(progress: IndexingProgress): void {
  currentProgress = progress;
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("indexing:progress", progress);
  }
}

// Check if file exists before attempting extraction
async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// Main indexing function
export async function startIndexing(): Promise<IndexingProgress> {
  if (isIndexing) {
    return currentProgress;
  }

  isIndexing = true;

  try {
    // Phase 1: Scan for unindexed
    emitProgress({ phase: "scanning", processed: 0, total: 0 });

    const unindexed = getUnindexedAttachments();
    const total = unindexed.length;

    if (total === 0) {
      const result: IndexingProgress = {
        phase: "complete",
        processed: 0,
        total: 0,
      };
      emitProgress(result);
      isIndexing = false;
      return result;
    }

    console.log(`[indexing] Starting indexing of ${total} attachments`);

    // Phase 2: Process in batches
    let processed = 0;

    for (let i = 0; i < unindexed.length; i += BATCH_SIZE) {
      const batch = unindexed.slice(i, i + BATCH_SIZE);

      // Process batch concurrently via worker pool
      const promises = batch.map(async (attachment) => {
        // Skip if file doesn't exist
        if (!(await fileExists(attachment.absolutePath))) {
          return null;
        }

        const result = await extractDimensionsInWorker({
          localPath: attachment.localPath,
          absolutePath: attachment.absolutePath,
          type: attachment.type,
        });

        if (result.width > 0 && result.height > 0) {
          setDimensions(result.localPath, result.width, result.height);
        }

        return result;
      });

      await Promise.all(promises);
      processed += batch.length;

      emitProgress({
        phase: "indexing",
        processed,
        total,
        currentFile: batch[batch.length - 1]?.localPath,
      });
    }

    // Save cache to disk
    await saveDimensionsCache();

    // Shutdown worker pool after indexing completes
    await shutdownDimensionPool();

    console.log(`[indexing] Completed indexing of ${processed} attachments`);

    const result: IndexingProgress = { phase: "complete", processed, total };
    emitProgress(result);
    isIndexing = false;
    return result;
  } catch (err) {
    const error = (err as Error).message;
    console.error("[indexing] Error during indexing:", error);
    const result: IndexingProgress = {
      phase: "error",
      processed: currentProgress.processed,
      total: currentProgress.total,
      error,
    };
    emitProgress(result);
    isIndexing = false;
    return result;
  }
}
