export type {
  SearchFilters,
  SearchOptions,
  SearchResultItem,
  SearchResponse,
  IndexStatus,
  IndexBuildResult,
} from "./types";

export { SearchIndexService } from "./service";

export {
  normalizePhone,
  escapeFtsQuery,
  escapeRegex,
  createSnippet,
} from "./snippets";

export { registerSearchHandlers, initializeSearchService } from "./handlers";
