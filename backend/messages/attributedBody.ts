// Parser for iMessage attributedBody BLOB format
// The attributedBody is a serialized NSAttributedString (NSKeyedArchiver format)
// This extracts the plain text content from the binary blob

/**
 * Extracts plain text from an attributedBody BLOB.
 *
 * The format is an NSKeyedArchiver-serialized NSAttributedString.
 * The text content appears after "NSString" class marker with pattern:
 * - 01 94/95 84 01 2B length_bytes text_bytes
 *
 * Length encoding:
 * - If length < 128: single byte
 * - If length >= 128: 0x81 marker followed by 2 bytes little-endian
 *
 * @param blob - The attributedBody Buffer from SQLite
 * @returns The extracted text, or null if parsing fails
 */
export function parseAttributedBody(blob: Buffer | null): string | null {
  if (!blob || blob.length === 0) {
    return null;
  }

  try {
    // Find "NSString" marker in the blob
    const nsStringMarker = Buffer.from("NSString");
    const nsIdx = blob.indexOf(nsStringMarker);

    if (nsIdx === -1) {
      return null;
    }

    // Skip past "NSString" + null byte
    const afterNs = blob.subarray(nsIdx + 9);

    // Find the 0x2B marker (ASCII "+") which indicates non-empty string
    // It should appear within the first ~10 bytes after NSString
    let markerPos = -1;
    for (let i = 0; i < Math.min(10, afterNs.length); i++) {
      if (afterNs[i] === 0x2b) {
        markerPos = i;
        break;
      }
    }

    if (markerPos === -1) {
      return null;
    }

    // Read length byte(s) after the 0x2B marker
    const lenByte = afterNs[markerPos + 1];
    let textLength: number;
    let textStart: number;

    if (lenByte < 0x80) {
      // Simple length encoding
      textLength = lenByte;
      textStart = markerPos + 2;
    } else if (lenByte === 0x81) {
      // Extended length: next 2 bytes are little-endian length
      if (afterNs.length < markerPos + 4) {
        return null;
      }
      textLength = afterNs[markerPos + 2] | (afterNs[markerPos + 3] << 8);
      textStart = markerPos + 4;
    } else if (lenByte === 0x82) {
      // Very long strings: next 3 bytes little-endian
      if (afterNs.length < markerPos + 5) {
        return null;
      }
      textLength = afterNs[markerPos + 2] |
                   (afterNs[markerPos + 3] << 8) |
                   (afterNs[markerPos + 4] << 16);
      textStart = markerPos + 5;
    } else {
      // Unknown encoding
      return null;
    }

    // Bounds check
    if (textStart + textLength > afterNs.length) {
      // Truncate to available data
      textLength = afterNs.length - textStart;
    }

    if (textLength <= 0) {
      return null;
    }

    // Extract and decode the text
    const textBytes = afterNs.subarray(textStart, textStart + textLength);
    const text = textBytes.toString("utf-8");

    // Return the text (caller should handle U+FFFC replacement chars)
    return text;
  } catch {
    return null;
  }
}
