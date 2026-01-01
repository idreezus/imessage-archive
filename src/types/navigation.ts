// Navigation target types for unified message navigation

// Date-based navigation (timeline scrubber, jumping to a date)
export type DateNavigationTarget = {
  type: 'date';
  date: number; // JS timestamp (milliseconds)
};

// Row ID navigation (search result click, direct message linking)
export type RowIdNavigationTarget = {
  type: 'rowId';
  rowId: number;
  fallbackDate?: number; // JS timestamp - used if rowId not found
};

// Month key navigation (jumping to specific month)
export type MonthKeyNavigationTarget = {
  type: 'monthKey';
  monthKey: string; // Format: "YYYY-MM"
};

// Union type for all navigation targets
export type NavigationTarget =
  | DateNavigationTarget
  | RowIdNavigationTarget
  | MonthKeyNavigationTarget;

// Result from navigation operation
export type NavigationResult = {
  success: boolean;
  targetRowId: number | null;
  found: boolean;
};
