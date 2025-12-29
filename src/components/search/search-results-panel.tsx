import { useState, useEffect } from "react";
import { useSearchContext } from "./search-context";
import { SearchResults } from "./search-results";
import type { SearchResultItem } from "@/types/search";

type SearchResultsPanelProps = {
  onResultClick: (result: SearchResultItem) => void;
};

export function SearchResultsPanel({ onResultClick }: SearchResultsPanelProps) {
  const search = useSearchContext();
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [search.results]);

  // Keyboard navigation
  useEffect(() => {
    if (!search.isSearchActive || search.results.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, search.results.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          if (selectedIndex >= 0 && selectedIndex < search.results.length) {
            e.preventDefault();
            onResultClick(search.results[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search.isSearchActive, search.results, selectedIndex, onResultClick]);

  return (
    <SearchResults
      results={search.results}
      total={search.total}
      isLoading={search.isLoading}
      hasMore={search.hasMore}
      onLoadMore={search.loadMore}
      onResultClick={onResultClick}
      selectedIndex={selectedIndex}
    />
  );
}
