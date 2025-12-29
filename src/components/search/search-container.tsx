import { useSearchContext } from "./search-context";
import { SearchBar } from "./search-bar";
import { SearchFilters } from "./search-filters";
import { ActiveFilters } from "./active-filters";

export function SearchContainer() {
  const search = useSearchContext();

  return (
    <div className="flex flex-col">
      <SearchBar
        value={search.filters.query}
        onChange={search.setQuery}
        onClear={search.clearAll}
        onToggleFilters={search.toggleFilters}
        isSearchActive={search.isSearchActive}
        activeFiltersCount={search.activeFiltersCount}
        isLoading={search.isLoading}
        isFiltersOpen={search.isFiltersOpen}
      />

      <SearchFilters
        filters={search.filters}
        onDateRangeChange={search.setDateRange}
        onSendersChange={search.setSenders}
        onChatTypeChange={search.setChatType}
        onDirectionChange={search.setDirection}
        onServiceChange={search.setService}
        onHasAttachmentChange={search.setHasAttachment}
        onSpecificChatChange={search.setSpecificChat}
        onRegexModeChange={search.setRegexMode}
        isOpen={search.isFiltersOpen}
      />

      <ActiveFilters
        filters={search.filters}
        onRemove={search.removeFilter}
      />
    </div>
  );
}
