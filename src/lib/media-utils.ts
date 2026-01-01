// Shared utilities for media display calculations

// Calculate display dimensions while strictly maintaining aspect ratio
// Used by ImageAttachment, VideoAttachment, and gallery thumbnails
export function calculateDisplayDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (naturalWidth === 0 || naturalHeight === 0) {
    return { width: maxWidth * 0.6, height: maxHeight * 0.6 };
  }

  const aspectRatio = naturalWidth / naturalHeight;
  let width = naturalWidth;
  let height = naturalHeight;

  // Scale down if exceeds max width (maintain aspect ratio)
  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  // Scale down further if still exceeds max height (maintain aspect ratio)
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height };
}
