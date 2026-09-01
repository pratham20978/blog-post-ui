"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useConfig } from "@/app/providers/ConfigProvider";
import { useBeacon } from "@/app/providers/EngagementProvider";
import { BlogCard } from "@/entities/blog/ui/BlogCard";
import { Field } from "@/shared/ui/Field";

import { createSearchAdapter, type SearchCorpus } from "../model/adapters";
import type { SearchHit } from "../model/port";

/** Results tagged with the query that produced them, so a slow response for an
 *  old query cannot be shown against a new one. */
interface Results {
  readonly forQuery: string;
  readonly hits: readonly SearchHit[];
}

/**
 * The full-page search results at `/search?q=`.
 *
 * URL-driven rather than state-driven, so a search is shareable, bookmarkable
 * and survives a reload — the difference between a results page and a filter
 * widget. The URL is the single source of truth for what is being searched;
 * the input is uncontrolled and keyed to it, so back and forward work without
 * an effect syncing state to a prop.
 */
export function SearchResults({ corpus }: { corpus: SearchCorpus }) {
  const { searchAdapter } = useConfig();
  const { record } = useBeacon();
  const router = useRouter();
  const params = useSearchParams();

  const query = (params.get("q") ?? "").trim();
  const [results, setResults] = useState<Results | null>(null);

  const adapter = useMemo(
    () => createSearchAdapter(searchAdapter, () => corpus),
    [searchAdapter, corpus],
  );

  const categoryLabels = useMemo(
    () => new Map(corpus.categories.map((entry) => [entry.key, entry.label])),
    [corpus.categories],
  );
  const seriesTitles = useMemo(
    () => new Map(corpus.series.map((entry) => [entry.id, entry.title])),
    [corpus.series],
  );

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();

    void adapter
      .search(query, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setResults({ forQuery: query, hits: response.hits });
        record({ kind: "search_impression", query_id: response.queryId, source: "search" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResults({ forQuery: query, hits: [] });
      });

    return () => controller.abort();
  }, [query, adapter, record]);

  // Only accept results that belong to the query in the URL right now.
  const current = results?.forQuery === query ? results : null;
  const hits = current?.hits ?? [];

  const status = !query
    ? "Type to search."
    : !current
      ? "Searching…"
      : `${hits.length} ${hits.length === 1 ? "result" : "results"} for “${query}”`;

  return (
    <div>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          const next = typeof value === "string" ? value.trim() : "";
          // `replace`, not `push`: refining a search should not stack a
          // history entry per attempt.
          router.replace(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
        }}
      >
        <Field
          // Keyed to the URL so navigating back or forward remounts the input
          // with the right text — no effect, no controlled-state sync.
          key={query}
          defaultValue={query}
          label="Search articles"
          hideLabel
          type="search"
          name="q"
          placeholder="Search by title, summary, category or series"
          className="h-14 text-[1.0625rem]"
          autoFocus
        />
      </form>

      <p aria-live="polite" className="mt-6 text-meta text-muted">
        {status}
      </p>

      {current && hits.length === 0 && (
        <p className="mt-10 text-[0.9375rem] text-muted">
          Nothing matched. Try a broader term, or browse by series.
        </p>
      )}

      {hits.length > 0 && (
        <ul className="mt-10 flex flex-col gap-12">
          {hits.map((hit, index) => (
            <li key={hit.blog.id}>
              <BlogCard
                blog={hit.blog}
                variant="split"
                position={index}
                categoryLabels={categoryLabels}
                seriesTitle={
                  hit.blog.series_id ? seriesTitles.get(hit.blog.series_id) : undefined
                }
                onSelect={(blog, position) =>
                  record({ kind: "click", blog_id: blog.id, position, source: "search" })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
