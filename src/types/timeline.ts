// Types for the timeline scrubber component and date-based navigation

// Individual entry in the date index representing a month with activity
export type DateIndexEntry = {
  monthKey: string; // "YYYY-MM" format
  year: number;
  month: number; // 1-12
  firstDate: number; // JS timestamp of first item in month
  count: number; // Number of items in this month
};

// Response from date index queries
export type DateIndexResponse = {
  entries: DateIndexEntry[];
  totalMonths: number;
  totalYears: number;
};

// Individual tick in the timeline scrubber (Google Photos style)
export type TimelineTick = {
  key: string; // Unique identifier (monthKey)
  label: string; // Full label shown on hover (e.g., "Jan 2024")
  yearLabel?: string; // Year label only for January ticks
  date: number; // JS timestamp for navigation
  granularity: 'month'; // Always month-level
  isYearStart: boolean; // True for January ticks
};
