// Worker thread for thumbnail generation (runs off main thread)

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
    }
  | {
      type: "heic-full";
      buffer: Buffer;
      quality: number;
    };

// Result type includes original dimensions for layout shift prevention
export type ThumbnailResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

interface TaskMessage {
  type: "task";
  taskId: string;
  data: ThumbnailTask;
}

async function processImageThumbnail(
  buffer: Buffer,
  size: number,
  isHeic: boolean
): Promise<ThumbnailResult> {
  let inputBuffer = buffer;

  if (isHeic) {
    inputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });
  }

  // Get original dimensions BEFORE resize, accounting for EXIF rotation
  const metadata = await sharp(inputBuffer).metadata();
  let width = metadata.width ?? 0;
  let height = metadata.height ?? 0;

  // EXIF orientations 5-8 indicate 90 degree rotation (swap dimensions)
  const orientation = metadata.orientation ?? 1;
  if (orientation >= 5 && orientation <= 8) {
    [width, height] = [height, width];
  }

  const thumbnailBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(size, size, { fit: "cover", position: "center" })
    .webp({ quality: 80 })
    .toBuffer();

  return { buffer: thumbnailBuffer, width, height };
}

async function processHeicFull(buffer: Buffer, quality: number): Promise<Buffer> {
  return heicConvert({
    buffer,
    format: "JPEG",
    quality,
  });
}

// Get video dimensions using ffprobe
async function getVideoDimensions(
  filePath: string
): Promise<{ width: number; height: number }> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      filePath,
    ]);
    const [width, height] = stdout.trim().split(",").map(Number);
    return { width: width || 0, height: height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function processVideoThumbnail(
  filePath: string,
  size: number
): Promise<ThumbnailResult> {
  const tempFile = path.join(
    os.tmpdir(),
    `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  );

  // Get original video dimensions
  const { width, height } = await getVideoDimensions(filePath);

  try {
    // Try extracting frame at 1 second
    try {
      await execFileAsync("ffmpeg", [
        "-i",
        filePath,
        "-ss",
        "00:00:01",
        "-vframes",
        "1",
        "-vf",
        `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
        "-y",
        tempFile,
      ]);
    } catch {
      // Video too short, try first frame
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

    const buffer = await sharp(tempFile).webp({ quality: 80 }).toBuffer();
    return { buffer, width, height };
  } finally {
    fs.promises.unlink(tempFile).catch(() => {});
  }
}

async function processTask(
  task: ThumbnailTask
): Promise<Buffer | ThumbnailResult> {
  if (task.type === "image") {
    return processImageThumbnail(task.buffer, task.size, task.isHeic);
  } else if (task.type === "video") {
    return processVideoThumbnail(task.filePath, task.size);
  } else if (task.type === "heic-full") {
    // HEIC full conversion returns just buffer (no dimensions needed)
    return processHeicFull(task.buffer, task.quality);
  } else {
    throw new Error(`Unknown task type: ${(task as ThumbnailTask).type}`);
  }
}

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

parentPort?.postMessage({ type: "ready" });
