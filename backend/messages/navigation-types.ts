// Navigation target types for unified message navigation API

import type { Message } from "./types";

// Navigate to a specific date (JS timestamp in milliseconds)
export type NavigationTargetDate = {
  type: "date";
  date: number;
};

// Navigate to a specific message by rowId with optional fallback
export type NavigationTargetRowId = {
  type: "rowId";
  rowId: number;
  fallbackDate?: number; // JS timestamp to use if rowId not found
};

// Navigate to the first message of a month
export type NavigationTargetMonthKey = {
  type: "monthKey";
  monthKey: string; // "YYYY-MM" format
};

// Union type for all navigation targets
export type NavigationTarget =
  | NavigationTargetDate
  | NavigationTargetRowId
  | NavigationTargetMonthKey;

// Options for getMessagesAround query
export type GetMessagesAroundOptions = {
  chatId: number;
  target: NavigationTarget;
  contextCount?: number; // Defaults to 25
};

// Result from getMessagesAround query
export type GetMessagesAroundResult = {
  messages: Message[];
  targetIndex: number; // Pre-computed index to scroll to
  targetRowId: number | null; // The actual rowId found (null if not found)
  found: boolean; // Whether the exact target was found
  hasMore: {
    before: boolean; // More messages exist before the first message
    after: boolean; // More messages exist after the last message
  };
};
