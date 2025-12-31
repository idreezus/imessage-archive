// Worker thread for fast dimension extraction only (no thumbnail generation)
// Images: sharp.metadata() reads EXIF headers without decoding pixels (~1-5ms)
// Videos: ffprobe reads container metadata (~50-100ms)

import { parentPort } from "worker_threads";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type DimensionTask = {
  localPath: string;
  absolutePath: string;
  type: "image" | "video";
};

export type DimensionResult = {
  localPath: string;
  width: number;
  height: number;
  error?: string;
};

interface TaskMessage {
  type: "task";
  taskId: string;
  data: DimensionTask;
}

// Extract image dimensions using sharp metadata (fast, no decoding)
async function extractImageDimensions(
  absolutePath: string
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(absolutePath).metadata();
  let width = metadata.width ?? 0;
  let height = metadata.height ?? 0;

  // EXIF orientations 5-8 indicate 90 degree rotation (swap dimensions)
  const orientation = metadata.orientation ?? 1;
  if (orientation >= 5 && orientation <= 8) {
    [width, height] = [height, width];
  }

  return { width, height };
}

// Extract video dimensions using ffprobe
async function extractVideoDimensions(
  absolutePath: string
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
      absolutePath,
    ]);
    const [width, height] = stdout.trim().split(",").map(Number);
    return { width: width || 0, height: height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function processTask(task: DimensionTask): Promise<DimensionResult> {
  try {
    const dims =
      task.type === "image"
        ? await extractImageDimensions(task.absolutePath)
        : await extractVideoDimensions(task.absolutePath);

    return { localPath: task.localPath, ...dims };
  } catch (err) {
    return {
      localPath: task.localPath,
      width: 0,
      height: 0,
      error: (err as Error).message,
    };
  }
}

parentPort?.on("message", async (msg: TaskMessage) => {
  if (msg.type !== "task") return;

  const { taskId, data } = msg;

  try {
    const result = await processTask(data);
    parentPort?.postMessage({ type: "result", taskId, data: result });
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
