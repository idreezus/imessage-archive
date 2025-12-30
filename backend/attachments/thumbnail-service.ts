import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

// Generate image thumbnail using sharp
export async function generateImageThumbnail(
  inputBuffer: Buffer,
  size: number
): Promise<Buffer> {
  return sharp(inputBuffer)
    .rotate() // Auto-orient from EXIF
    .resize(size, size, { fit: "cover", position: "center" })
    .webp({ quality: 80 })
    .toBuffer();
}

// Generate video thumbnail by extracting a frame with ffmpeg
export async function generateVideoThumbnail(
  inputPath: string,
  size: number
): Promise<Buffer> {
  // Create unique temp file
  const tempFile = path.join(os.tmpdir(), `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);

  try {
    // Extract frame at 1 second (or first frame if shorter)
    await execFileAsync("ffmpeg", [
      "-i",
      inputPath,
      "-ss",
      "00:00:01", // Seek to 1 second
      "-vframes",
      "1", // Extract 1 frame
      "-vf",
      `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
      "-y", // Overwrite if exists
      tempFile,
    ]);

    // Read and convert to WebP with sharp
    const buffer = await sharp(tempFile).webp({ quality: 80 }).toBuffer();

    return buffer;
  } catch (err) {
    // If extraction at 1s fails (video too short), try first frame
    try {
      await execFileAsync("ffmpeg", [
        "-i",
        inputPath,
        "-vframes",
        "1",
        "-vf",
        `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
        "-y",
        tempFile,
      ]);

      const buffer = await sharp(tempFile).webp({ quality: 80 }).toBuffer();
      return buffer;
    } catch {
      throw new Error(`Video thumbnail generation failed: ${(err as Error).message}`);
    }
  } finally {
    // Cleanup temp file
    fs.promises.unlink(tempFile).catch(() => {});
  }
}

// Check if file extension indicates video
export function isVideoFile(ext: string): boolean {
  const videoExtensions = [".mp4", ".mov", ".m4v", ".avi", ".webm", ".mkv"];
  return videoExtensions.includes(ext.toLowerCase());
}
