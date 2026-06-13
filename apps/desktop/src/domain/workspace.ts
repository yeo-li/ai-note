import type { ContextSearchResult } from "./search";

export type SidebarView = "all" | "favorites";

export type ContextSearchState = {
  query: string;
  results: ContextSearchResult[];
  hasSearched: boolean;
  isLoading: boolean;
};

export type SidebarSearchMode = "keyword" | "ai-context";
export type SidebarSurface = "notes" | "ai-context" | "compose";
