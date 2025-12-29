import { useRef, useEffect } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onToggleFilters: () => void;
  isSearchActive: boolean;
  activeFiltersCount: number;
  isLoading: boolean;
  isFiltersOpen: boolean;
};

export function SearchBar({
  value,
  onChange,
  onClear,
  onToggleFilters,
  isSearchActive,
  activeFiltersCount,
  isLoading,
  isFiltersOpen,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Cmd+Shift+F to toggle filters
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        onToggleFilters();
      }
      // Escape to clear search
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (value) {
          onClear();
        } else {
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggleFilters, onClear, value]);

  return (
    <InputGroup className="h-9">
      <InputGroupAddon align="inline-start">
        {isLoading ? (
          <Spinner className="size-4" />
        ) : (
          <Search className="size-4" />
        )}
      </InputGroupAddon>

      <InputGroupInput
        ref={inputRef}
        placeholder="Search messages..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <InputGroupAddon align="inline-end" className="gap-1">
        <kbd className="text-muted-foreground text-[10px] hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted">
          <span className="text-xs">⌘</span>K
        </kbd>

        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeFiltersCount}
          </Badge>
        )}

        <InputGroupButton
          variant={isFiltersOpen ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={onToggleFilters}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal className="size-4" />
        </InputGroupButton>

        {isSearchActive && (
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            aria-label="Clear search"
          >
            <X className="size-4" />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
