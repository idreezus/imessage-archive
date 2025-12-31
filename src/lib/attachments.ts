import type { Attachment } from '@/types';

// Format file size for display (e.g., "1.2 MB")
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Get display filename from attachment
export function getDisplayName(attachment: Attachment): string {
  return (
    attachment.transferName ||
    attachment.filename?.split('/').pop() ||
    'Unknown file'
  );
}

// Check if attachment is a renderable image
export function isRenderableImage(attachment: Attachment): boolean {
  const mime = attachment.mimeType?.toLowerCase() || '';
  return [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ].includes(mime);
}

// Check if attachment is a renderable video
export function isRenderableVideo(attachment: Attachment): boolean {
  const mime = attachment.mimeType?.toLowerCase() || '';
  return [
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/webm',
  ].includes(mime);
}

// Check if attachment is playable audio
// Note: AMR and CAF formats are NOT browser-playable
export function isPlayableAudio(attachment: Attachment): boolean {
  const mime = attachment.mimeType?.toLowerCase() || '';
  return [
    'audio/x-m4a',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
  ].includes(mime);
}

// Check if an attachment is a media type (image or video) that should render standalone.
export function isMediaAttachment(attachment: Attachment): boolean {
  return attachment.type === 'image' || attachment.type === 'video';
}

// Get file extension from filename or mime type
export function getFileExtension(attachment: Attachment): string {
  const filename = attachment.transferName || attachment.filename;
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext) return ext;
  }

  // Fallback to mime type
  const mime = attachment.mimeType?.toLowerCase() || '';
  const mimeExtMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/x-m4a': 'm4a',
  };

  return mimeExtMap[mime] || '';
}
