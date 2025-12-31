import { useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { SearchResultItem } from './search-result-item';
import { SearchResultSkeleton } from './search-result-skeleton';
import type { SearchResultItem as SearchResultItemType } from '@/types/search';

type SearchResultsProps = {
  results: SearchResultItemType[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onResultClick: (result: SearchResultItemType) => void;
  selectedIndex?: number;
};

export function SearchResults({
  results,
  total,
  isLoading,
  hasMore,
  onLoadMore,
  onResultClick,
  selectedIndex = -1,
}: SearchResultsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Infinite scroll - load more when reaching bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !hasMore || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 100;

    if (scrollHeight - scrollTop - clientHeight < threshold) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Scroll selected item into view when using keyboard navigation
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const selectedElement = document.querySelector(
        `[data-search-result-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results.length]);

  // Initial loading state
  if (isLoading && results.length === 0) {
    return (
      <div className="flex-1 overflow-hidden">
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <SearchResultSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // No results
  if (!isLoading && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Empty>
          <EmptyMedia variant="icon">
            <Search className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filters
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Results count */}
      <div className="px-4 pb-2 text-xs text-muted-foreground border-b shrink-0">
        {total.toLocaleString()} result{total !== 1 ? 's' : ''}
      </div>

      {/* Results list - using native overflow scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0"
        onScroll={handleScroll}
      >
        <div className="divide-y">
          {results.map((result, index) => (
            <div
              key={`${result.messageRowid}-${result.chatRowid}`}
              data-search-result-index={index}
            >
              <SearchResultItem
                result={result}
                onResultClick={onResultClick}
                isSelected={index === selectedIndex}
              />
            </div>
          ))}

          {/* Load more indicator */}
          {hasMore && (
            <div className="py-2">
              {isLoading ? (
                <SearchResultSkeleton />
              ) : (
                <button
                  onClick={onLoadMore}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Load more results...
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
