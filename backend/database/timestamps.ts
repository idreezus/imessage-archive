// Apple epoch offset: milliseconds from Unix epoch (1970) to Apple epoch (2001)
export const APPLE_EPOCH_OFFSET_MS = 978307200000;

// Convert Apple timestamp (nanoseconds since 2001) to JS timestamp (ms since 1970).
export function appleToJsTimestamp(appleDate: number | null): number {
  if (appleDate === null || appleDate === 0) return 0;
  return Math.floor(appleDate / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
}

// Convert JS timestamp back to Apple format for query comparisons.
export function jsToAppleTimestamp(jsDate: number): number {
  return (jsDate - APPLE_EPOCH_OFFSET_MS) * 1_000_000;
}
