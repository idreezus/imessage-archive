import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SearchFilters } from "@/types/search";
import { format } from "date-fns";

type FilterBadge = {
  key: string;
  label: string;
};

type ActiveFiltersProps = {
  filters: SearchFilters;
  onRemove: (filterKey: string) => void;
};

const DATE_PRESET_LABELS: Record<string, string> = {
  today: "Today",
  "7days": "Past 7 days",
  "30days": "Past 30 days",
  year: "This year",
};

export function ActiveFilters({ filters, onRemove }: ActiveFiltersProps) {
  const badges: FilterBadge[] = [];

  // Date range
  if (filters.dateRange.from || filters.dateRange.to) {
    let label: string;
    if (filters.dateRange.preset && filters.dateRange.preset !== "custom") {
      label = DATE_PRESET_LABELS[filters.dateRange.preset] || filters.dateRange.preset;
    } else if (filters.dateRange.from && filters.dateRange.to) {
      label = `${format(filters.dateRange.from, "MMM d")} - ${format(filters.dateRange.to, "MMM d")}`;
    } else if (filters.dateRange.from) {
      label = `From ${format(filters.dateRange.from, "MMM d")}`;
    } else {
      label = "Date filter";
    }
    badges.push({ key: "dateRange", label });
  }

  // Senders
  filters.senders.forEach((sender) => {
    badges.push({ key: `sender:${sender}`, label: `From: ${sender}` });
  });

  // Chat type
  if (filters.chatType !== "all") {
    badges.push({
      key: "chatType",
      label: filters.chatType === "dm" ? "DMs only" : "Groups only",
    });
  }

  // Direction
  if (filters.direction !== "all") {
    badges.push({
      key: "direction",
      label: filters.direction === "sent" ? "Sent" : "Received",
    });
  }

  // Service
  if (filters.service !== "all") {
    badges.push({ key: "service", label: filters.service });
  }

  // Has attachment
  if (filters.hasAttachment !== null) {
    badges.push({
      key: "hasAttachment",
      label: filters.hasAttachment ? "With attachments" : "No attachments",
    });
  }

  // Specific chat
  if (filters.specificChat !== null) {
    badges.push({ key: "specificChat", label: `Chat #${filters.specificChat}` });
  }

  // Regex mode
  if (filters.regexMode) {
    badges.push({ key: "regexMode", label: "Regex" });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 gap-1 pr-1"
          onClick={() => onRemove(badge.key)}
        >
          {badge.label}
          <X className="size-3" />
        </Badge>
      ))}
    </div>
  );
}
