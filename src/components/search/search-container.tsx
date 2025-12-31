import { useSearchContext } from './search-context';
import { SearchBar } from './search-bar';
import { SearchFilters } from './search-filters';
import { ActiveFilters } from './search-active-filters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function SearchContainer() {
  const search = useSearchContext();

  return (
    <>
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

      <Dialog open={search.isFiltersOpen} onOpenChange={search.toggleFilters}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Search Filters</DialogTitle>
            {search.isSearchActive && (
              <DialogDescription>
                {search.total.toLocaleString()} {search.total === 1 ? 'result' : 'results'}
              </DialogDescription>
            )}
          </DialogHeader>
          <ActiveFilters filters={search.filters} onRemove={search.removeFilter} />
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
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
