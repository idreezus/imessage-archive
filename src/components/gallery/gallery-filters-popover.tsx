import { memo, useState } from 'react';
import {
  SlidersHorizontal,
  CalendarIcon,
  ChevronDown,
  Image,
  Video,
  Music,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
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

const TYPE_OPTIONS: {
  value: AttachmentType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: 'image', label: 'Photos', icon: <Image className="size-4" /> },
  { value: 'video', label: 'Videos', icon: <Video className="size-4" /> },
  { value: 'audio', label: 'Audio', icon: <Music className="size-4" /> },
  { value: 'document', label: 'Files', icon: <FileText className="size-4" /> },
];

const DATE_PRESETS: { value: GalleryDatePreset; label: string }[] = [
  { value: '7days', label: '7d' },
  { value: '30days', label: '30d' },
  { value: 'year', label: 'Year' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'size', label: 'Size' },
  { value: 'type', label: 'Type' },
] as const;

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono tracking-tight text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export const GalleryFiltersPopover = memo(function GalleryFiltersPopover() {
  const {
    filters,
    isFiltered,
    setTypeFilter,
    setDirection,
    setDateRange,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
  } = useGalleryContext();

  const [isOpen, setIsOpen] = useState(false);
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative">
              <SlidersHorizontal className="size-5" />
              {isFiltered && (
                <span className="absolute top-1 right-1 size-2 bg-primary rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Filters</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-86">
        <div className="flex flex-col gap-4">
          {/* Media Type */}
          <FilterSection label="Media Type">
            <ToggleGroup
              type="multiple"
              size="sm"
              className="w-full"
              variant="outline"
              value={typeValue}
              onValueChange={handleTypeChange}
            >
              {TYPE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="gap-1 flex-1"
                >
                  {option.icon}
                  <span className="text-xs">{option.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterSection>

          {/* Message Type */}
          <FilterSection label="Message Type">
            <ToggleGroup
              type="single"
              className="w-full"
              size="sm"
              variant="outline"
              value={filters.direction}
              onValueChange={(v) =>
                v && setDirection(v as 'all' | 'sent' | 'received')
              }
            >
              <ToggleGroupItem value="all" className="flex-1">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="sent" className="flex-1">
                Sent
              </ToggleGroupItem>
              <ToggleGroupItem value="received" className="flex-1">
                Received
              </ToggleGroupItem>
            </ToggleGroup>
          </FilterSection>

          {/* Date (includes sort) */}
          <FilterSection label="Date">
            <div className="flex flex-col gap-2">
              {/* Date presets row */}
              <div className="flex gap-1">
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={
                    filters.dateRange.preset &&
                    filters.dateRange.preset !== 'custom'
                      ? filters.dateRange.preset
                      : ''
                  }
                  onValueChange={handleDatePresetChange}
                  className="w-full"
                >
                  {DATE_PRESETS.map((preset) => (
                    <ToggleGroupItem
                      key={preset.value}
                      value={preset.value}
                      className="flex-1"
                    >
                      {preset.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild className="p-2">
                    <Button
                      variant={
                        filters.dateRange.preset === 'custom'
                          ? 'secondary'
                          : 'outline'
                      }
                      size="sm"
                    >
                      <CalendarIcon className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
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

              {/* Show custom date range if selected */}
              {filters.dateRange.preset === 'custom' &&
                (filters.dateRange.from || filters.dateRange.to) && (
                  <span className="text-xs text-muted-foreground">
                    {formatDateRange()}
                  </span>
                )}

              {/* Sort row */}
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-between"
                    >
                      Sort by {currentSortLabel}
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
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
                  variant="outline"
                  size="icon-sm"
                  onClick={toggleSortOrder}
                  aria-label={
                    sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'
                  }
                >
                  <ArrowUpDown
                    className={`size-4 transition-transform ${
                      sortOrder === 'asc' ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </div>
            </div>
          </FilterSection>
        </div>
      </PopoverContent>
    </Popover>
  );
});
