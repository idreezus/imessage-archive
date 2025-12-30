// Normalize phone number for consistent matching.
// Strips formatting and handles common variants.
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, "");

  // Handle +1 prefix for US numbers
  if (normalized.startsWith("+1") && normalized.length === 12) {
    // Keep as +1XXXXXXXXXX
    return normalized;
  }

  // If 10 digits without country code, assume US
  if (/^\d{10}$/.test(normalized)) {
    return "+1" + normalized;
  }

  // Return as-is for other formats (emails, international)
  return normalized || phone;
}

// Escape special FTS5 query characters.
export function escapeFtsQuery(query: string): string {
  // For simple queries, wrap each word in quotes to do phrase matching
  // Handle special characters by escaping
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return '""';

  // Escape each word and join with AND
  return words
    .map((word) => {
      // Escape quotes and special chars
      const escaped = word.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(" ");
}

// Escape special regex characters.
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Create a snippet with highlighted match.
export function createSnippet(
  text: string | null,
  query: string,
  isRegex = false
): string {
  if (!text) return "";

  const maxLength = 150;
  const contextChars = 50;

  if (!query || !query.trim()) {
    // No query, just truncate
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  let matchIndex = -1;
  let matchLength = 0;

  if (isRegex) {
    try {
      const regex = new RegExp(query, "i");
      const match = text.match(regex);
      if (match && match.index !== undefined) {
        matchIndex = match.index;
        matchLength = match[0].length;
      }
    } catch {
      // Invalid regex, fall back to simple search
    }
  }

  if (matchIndex === -1) {
    // Simple case-insensitive search for first query word
    const firstWord = query.trim().split(/\s+/)[0].toLowerCase();
    const lowerText = text.toLowerCase();
    matchIndex = lowerText.indexOf(firstWord);
    if (matchIndex >= 0) {
      matchLength = firstWord.length;
    }
  }

  if (matchIndex === -1) {
    // No match found, return truncated text
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  // Extract snippet around match
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(text.length, matchIndex + matchLength + contextChars);

  let snippet = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  // Wrap match in <mark> tags
  const matchText = text.substring(matchIndex, matchIndex + matchLength);
  snippet = snippet.replace(
    new RegExp(escapeRegex(matchText), "gi"),
    "<mark>$&</mark>"
  );

  return snippet;
}
