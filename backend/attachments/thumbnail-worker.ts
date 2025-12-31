/**
 * Thumbnail Worker
 *
 * Runs in a worker thread to process thumbnails without blocking the main thread.
 * Handles: image resizing, HEIC conversion, video frame extraction.
 */

import { parentPort } from "worker_threads";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
// @ts-expect-error - heic-convert has no type definitions
import heicConvert from "heic-convert";

const execFileAsync = promisify(execFile);

// Task types that can be processed by this worker
export type ThumbnailTask =
  | {
      type: "image";
      buffer: Buffer;
      size: number;
      isHeic: boolean;
    }
  | {
      type: "video";
      filePath: string;
      size: number;
    };

// Message format received from the pool
interface TaskMessage {
  type: "task";
  taskId: string;
  data: ThumbnailTask;
}

/**
 * Process an image thumbnail
 */
async function processImageThumbnail(
  buffer: Buffer,
  size: number,
  isHeic: boolean
): Promise<Buffer> {
  let inputBuffer = buffer;

  // Convert HEIC to JPEG first if needed
  if (isHeic) {
    inputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });
  }

  // Process with sharp
  return sharp(inputBuffer)
    .rotate() // Auto-orient from EXIF
    .resize(size, size, { fit: "cover", position: "center" })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Process a video thumbnail by extracting a frame with ffmpeg
 */
async function processVideoThumbnail(
  filePath: string,
  size: number
): Promise<Buffer> {
  // Create unique temp file
  const tempFile = path.join(
    os.tmpdir(),
    `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  );

  try {
    // Extract frame at 1 second (or first frame if shorter)
    try {
      await execFileAsync("ffmpeg", [
        "-i",
        filePath,
        "-ss",
        "00:00:01", // Seek to 1 second
        "-vframes",
        "1", // Extract 1 frame
        "-vf",
        `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
        "-y", // Overwrite if exists
        tempFile,
      ]);
    } catch {
      // If extraction at 1s fails (video too short), try first frame
      await execFileAsync("ffmpeg", [
        "-i",
        filePath,
        "-vframes",
        "1",
        "-vf",
        `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
        "-y",
        tempFile,
      ]);
    }

    // Read and convert to WebP with sharp
    const buffer = await sharp(tempFile).webp({ quality: 80 }).toBuffer();

    return buffer;
  } finally {
    // Cleanup temp file
    fs.promises.unlink(tempFile).catch(() => {});
  }
}

/**
 * Process incoming task
 */
async function processTask(task: ThumbnailTask): Promise<Buffer> {
  if (task.type === "image") {
    return processImageThumbnail(task.buffer, task.size, task.isHeic);
  } else if (task.type === "video") {
    return processVideoThumbnail(task.filePath, task.size);
  } else {
    throw new Error(`Unknown task type: ${(task as ThumbnailTask).type}`);
  }
}

// Listen for messages from the main thread
parentPort?.on("message", async (msg: TaskMessage) => {
  if (msg.type !== "task") return;

  const { taskId, data } = msg;

  try {
    const result = await processTask(data);

    parentPort?.postMessage({
      type: "result",
      taskId,
      data: result,
    });
  } catch (err) {
    const error = err as Error;
    parentPort?.postMessage({
      type: "error",
      taskId,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Signal that worker is ready
parentPort?.postMessage({ type: "ready" });
