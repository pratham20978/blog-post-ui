import type { BlogSummary } from "@/shared/contracts";

/**
 * The search boundary.
 *
 * There is no search endpoint on the backend, and migration 001 states plainly
 * that full-text and trigram search are out of scope for this phase. So search
 * is defined as a port with two adapters: the UI is built once, against this
 * interface, and swapping in the real thing later is a config change rather
 * than a rewrite.
 */

export interface SearchHit {
  readonly blog: BlogSummary;
  /** Higher is better. Presentation ignores it; it exists so the ordering is
   *  inspectable and testable rather than an accident of filter order. */
  readonly score: number;
  /** Which fields matched, for the result list to explain itself. */
  readonly matchedOn: readonly ("title" | "summary" | "category" | "series")[];
}

export interface SearchResults {
  readonly hits: readonly SearchHit[];
  /** Ties a `search_impression` beacon to the query that produced it — the
   *  `query_id` field on the engagement log exists for exactly this. */
  readonly queryId: string;
}

export interface SearchPort {
  search(query: string, signal?: AbortSignal): Promise<SearchResults>;
}

export function newQueryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
