import { useEffect, useState } from "react";

import { useBeacon } from "@/app/providers/EngagementProvider";

import type { SearchHit, SearchPort } from "./port";

const NO_HITS: readonly SearchHit[] = [];

/** Results tagged with what produced them, so a slow answer to an old query —
 *  or to this query over a corpus that has since finished loading — is never
 *  taken for the answer to the current one. */
interface Results {
  readonly adapter: SearchPort;
  readonly query: string;
  readonly hits: readonly SearchHit[];
}

/**
 * Run what the reader is typing through a search adapter.
 *
 * Debounced, so a fast typist does not search per keystroke, and abortable, so
 * a superseded request is dropped rather than raced. Each settled search
 * records the `search_impression` the engagement log reserves for it.
 *
 * `hits` keeps the latest results while a newer query is in flight, so a list
 * refines in place instead of blanking between keystrokes; `settled` says
 * whether they answer the query as it reads now.
 */
export function useSearchHits(
  adapter: SearchPort,
  query: string,
  debounceMs = 150,
): { hits: readonly SearchHit[]; settled: boolean } {
  const { record } = useBeacon();
  const [results, setResults] = useState<Results | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void adapter.search(trimmed, controller.signal).then(
        (response) => {
          if (controller.signal.aborted) return;
          setResults({ adapter, query: trimmed, hits: response.hits });
          record({ kind: "search_impression", query_id: response.queryId, source: "search" });
        },
        () => {
          if (!controller.signal.aborted) setResults({ adapter, query: trimmed, hits: NO_HITS });
        },
      );
    }, debounceMs);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [adapter, trimmed, debounceMs, record]);

  if (!trimmed) return { hits: NO_HITS, settled: true };
  return {
    hits: results?.hits ?? NO_HITS,
    settled: results?.adapter === adapter && results.query === trimmed,
  };
}
