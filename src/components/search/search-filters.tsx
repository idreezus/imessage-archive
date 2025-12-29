import { useState, useEffect } from "react";
import { CalendarIcon, Code2, Paperclip } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import type { SearchFilters as SearchFiltersType, DatePreset, ChatFilterOption } from "@/types/search";
import type { Handle } from "@/types";
import { getDateRangeFromPreset } from "@/types/search";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

type SearchFiltersProps = {
  filters: SearchFiltersType;
  onDateRangeChange: (
    range: { from: Date | null; to: Date | null; preset: DatePreset | null } | DatePreset
  ) => void;
  onSendersChange: (senders: string[]) => void;
  onChatTypeChange: (chatType: "all" | "dm" | "group") => void;
  onDirectionChange: (direction: "all" | "sent" | "received") => void;
  onServiceChange: (service: "all" | "iMessage" | "SMS" | "RCS") => void;
  onHasAttachmentChange: (hasAttachment: boolean | null) => void;
  onSpecificChatChange: (specificChat: number | null) => void;
  onRegexModeChange: (regexMode: boolean) => void;
  isOpen: boolean;
};

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7days", label: "7 Days" },
  { value: "30days", label: "30 Days" },
  { value: "year", label: "This Year" },
];

export function SearchFilters({
  filters,
  onDateRangeChange,
  onSendersChange,
  onChatTypeChange,
  onDirectionChange,
  onServiceChange,
  onHasAttachmentChange,
  onSpecificChatChange,
  onRegexModeChange,
  isOpen,
}: SearchFiltersProps) {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [chats, setChats] = useState<ChatFilterOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load handles and chats for autocomplete when filters open
  useEffect(() => {
    if (isOpen && handles.length === 0 && chats.length === 0) {
      setIsLoadingData(true);
      Promise.all([
        window.electronAPI.getHandles(),
        window.electronAPI.getChatsForFilter(),
      ])
        .then(([handlesData, chatsData]) => {
          setHandles(handlesData);
          setChats(chatsData);
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [isOpen, handles.length, chats.length]);

  if (!isOpen) return null;

  const handleDatePresetChange = (preset: string) => {
    if (preset && preset !== "custom") {
      onDateRangeChange(preset as DatePreset);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onDateRangeChange({
      from: range?.from ?? null,
      to: range?.to ?? null,
      preset: "custom",
    });
  };

  const formatDateRange = () => {
    if (!filters.dateRange.from && !filters.dateRange.to) return "Pick a date range";
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, "MMM d")} - ${format(filters.dateRange.to, "MMM d, yyyy")}`;
    }
    if (filters.dateRange.from) {
      return `From ${format(filters.dateRange.from, "MMM d, yyyy")}`;
    }
    return "Pick a date range";
  };

  return (
    <div className="border-b p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Date Range */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Date Range</Label>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={filters.dateRange.preset ?? ""}
            onValueChange={handleDatePresetChange}
          >
            {DATE_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.value} value={preset.value}>
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={filters.dateRange.preset === "custom" ? "secondary" : "outline"}
                size="sm"
                className="gap-1"
              >
                <CalendarIcon className="size-4" />
                {filters.dateRange.preset === "custom" ? formatDateRange() : "Custom"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: filters.dateRange.from ?? undefined,
                  to: filters.dateRange.to ?? undefined,
                }}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Sender Filter */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Combobox
          value={filters.senders}
          onValueChange={onSendersChange}
          multiple
        >
          <ComboboxInput
            placeholder={isLoadingData ? "Loading..." : "Select contacts..."}
            showClear={filters.senders.length > 0}
            disabled={isLoadingData}
          />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxEmpty>No contacts found</ComboboxEmpty>
              {handles.map((handle) => (
                <ComboboxItem key={handle.id} value={handle.id}>
                  {handle.id}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* Chat Type & Direction in a row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Chat Type</Label>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={filters.chatType}
            onValueChange={(v) => v && onChatTypeChange(v as "all" | "dm" | "group")}
            className="w-full"
          >
            <ToggleGroupItem value="all" className="flex-1">All</ToggleGroupItem>
            <ToggleGroupItem value="dm" className="flex-1">DMs</ToggleGroupItem>
            <ToggleGroupItem value="group" className="flex-1">Groups</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Direction</Label>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={filters.direction}
            onValueChange={(v) => v && onDirectionChange(v as "all" | "sent" | "received")}
            className="w-full"
          >
            <ToggleGroupItem value="all" className="flex-1">All</ToggleGroupItem>
            <ToggleGroupItem value="sent" className="flex-1">Sent</ToggleGroupItem>
            <ToggleGroupItem value="received" className="flex-1">Recv</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Service Filter */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Service</Label>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={filters.service}
          onValueChange={(v) => v && onServiceChange(v as "all" | "iMessage" | "SMS" | "RCS")}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="iMessage">iMessage</ToggleGroupItem>
          <ToggleGroupItem value="SMS">SMS</ToggleGroupItem>
          <ToggleGroupItem value="RCS">RCS</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Specific Chat */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Specific Chat</Label>
        <Combobox
          value={filters.specificChat?.toString() ?? ""}
          onValueChange={(v) => onSpecificChatChange(v ? parseInt(v, 10) : null)}
        >
          <ComboboxInput
            placeholder={isLoadingData ? "Loading..." : "Any chat"}
            showClear={filters.specificChat !== null}
            disabled={isLoadingData}
          />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxEmpty>No chats found</ComboboxEmpty>
              {chats.map((chat) => (
                <ComboboxItem key={chat.rowid} value={chat.rowid.toString()}>
                  {chat.displayName || chat.chatIdentifier}
                  {chat.isGroup && <span className="text-muted-foreground ml-1">(group)</span>}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* Toggles row */}
      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Toggle
            size="sm"
            variant="outline"
            pressed={filters.hasAttachment === true}
            onPressedChange={(pressed) => onHasAttachmentChange(pressed ? true : null)}
          >
            <Paperclip className="size-4" />
          </Toggle>
          <span className="text-muted-foreground">Has attachment</span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Toggle
            size="sm"
            variant="outline"
            pressed={filters.regexMode}
            onPressedChange={onRegexModeChange}
          >
            <Code2 className="size-4" />
          </Toggle>
          <span className="text-muted-foreground">Regex</span>
          {filters.regexMode && (
            <span className="text-xs text-amber-500">(slower)</span>
          )}
        </label>
      </div>
    </div>
  );
}
