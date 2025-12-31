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

interface TaskMessage {
  type: "task";
  taskId: string;
  data: ThumbnailTask;
}

async function processImageThumbnail(
  buffer: Buffer,
  size: number,
  isHeic: boolean
): Promise<Buffer> {
  let inputBuffer = buffer;

  if (isHeic) {
    inputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });
  }

  return sharp(inputBuffer)
    .rotate()
    .resize(size, size, { fit: "cover", position: "center" })
    .webp({ quality: 80 })
    .toBuffer();
}

async function processHeicFull(buffer: Buffer, quality: number): Promise<Buffer> {
  return heicConvert({
    buffer,
    format: "JPEG",
    quality,
  });
}

async function processVideoThumbnail(
  filePath: string,
  size: number
): Promise<Buffer> {
  const tempFile = path.join(
    os.tmpdir(),
    `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  );

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
    return buffer;
  } finally {
    fs.promises.unlink(tempFile).catch(() => {});
  }
}

async function processTask(task: ThumbnailTask): Promise<Buffer> {
  if (task.type === "image") {
    return processImageThumbnail(task.buffer, task.size, task.isHeic);
  } else if (task.type === "video") {
    return processVideoThumbnail(task.filePath, task.size);
  } else if (task.type === "heic-full") {
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
