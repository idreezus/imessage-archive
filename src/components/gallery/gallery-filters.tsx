import { memo, useState } from 'react';
import {
  CalendarIcon,
  ChevronDown,
  Image,
  Video,
  Music,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGalleryContext } from './gallery-context';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { AttachmentType } from '@/types';
import type { GalleryDatePreset } from '@/types/gallery';

const TYPE_OPTIONS: { value: AttachmentType; label: string; icon: React.ReactNode }[] = [
  { value: 'image', label: 'Photos', icon: <Image className="size-4" /> },
  { value: 'video', label: 'Videos', icon: <Video className="size-4" /> },
  { value: 'audio', label: 'Audio', icon: <Music className="size-4" /> },
  { value: 'document', label: 'Files', icon: <FileText className="size-4" /> },
];

const DATE_PRESETS: { value: GalleryDatePreset; label: string }[] = [
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: 'year', label: 'This Year' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'size', label: 'Size' },
  { value: 'type', label: 'Type' },
] as const;

export const GalleryFilters = memo(function GalleryFilters() {
  const {
    filters,
    setTypeFilter,
    setDirection,
    setDateRange,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
    chatId,
  } = useGalleryContext();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Convert types to toggle group value
  const typeValue =
    filters.types === 'all' ? [] : (filters.types as AttachmentType[]);

  const handleTypeChange = (values: string[]) => {
    if (values.length === 0) {
      setTypeFilter('all');
    } else {
      setTypeFilter(values as AttachmentType[]);
    }
  };

  const handleDatePresetChange = (preset: string) => {
    if (preset) {
      setDateRange(preset as GalleryDatePreset);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setDateRange({
      from: range?.from ?? null,
      to: range?.to ?? null,
      preset: 'custom',
    });
  };

  const formatDateRange = () => {
    if (!filters.dateRange.from && !filters.dateRange.to) return 'Custom';
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'MMM d')} - ${format(
        filters.dateRange.to,
        'MMM d'
      )}`;
    }
    if (filters.dateRange.from) {
      return `From ${format(filters.dateRange.from, 'MMM d')}`;
    }
    return 'Custom';
  };

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Date';

  return (
    <div className="border-b px-4 py-2 flex flex-wrap items-center gap-2">
      {/* Type filter */}
      <ToggleGroup
        type="multiple"
        size="sm"
        variant="outline"
        value={typeValue}
        onValueChange={handleTypeChange}
      >
        {TYPE_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className="gap-1"
          >
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Direction filter */}
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={filters.direction}
        onValueChange={(v) => v && setDirection(v as 'all' | 'sent' | 'received')}
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="sent">Sent</ToggleGroupItem>
        <ToggleGroupItem value="received">Received</ToggleGroupItem>
      </ToggleGroup>

      {/* Date filter */}
      <div className="flex gap-1">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={
            filters.dateRange.preset && filters.dateRange.preset !== 'custom'
              ? filters.dateRange.preset
              : ''
          }
          onValueChange={handleDatePresetChange}
        >
          {DATE_PRESETS.map((preset) => (
            <ToggleGroupItem key={preset.value} value={preset.value}>
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={
                filters.dateRange.preset === 'custom' ? 'secondary' : 'outline'
              }
              size="sm"
              className="gap-1"
            >
              <CalendarIcon className="size-4" />
              <span className="hidden sm:inline">
                {filters.dateRange.preset === 'custom'
                  ? formatDateRange()
                  : 'Custom'}
              </span>
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort controls */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              {currentSortLabel}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSortBy(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSortOrder}
          aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
        >
          <ArrowUpDown
            className={`size-4 transition-transform ${
              sortOrder === 'asc' ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </div>
    </div>
  );
});
