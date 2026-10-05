"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useConfig } from "@/app/providers/ConfigProvider";
import { useBeacon } from "@/app/providers/EngagementProvider";
import { blogIndexQuery } from "@/entities/blog/api/client";
import { BlogCard } from "@/entities/blog/ui/BlogCard";
import type { BlogSummary, Category, KeyStr, Series } from "@/shared/contracts";
import { ListDialog } from "@/shared/ui/ListDialog";

import { createSearchAdapter } from "../model/adapters";
import { useSearchHits } from "../model/useSearchHits";

const NO_BLOGS: readonly BlogSummary[] = [];

/**
 * The whole archive in a scrolling, searchable dialog — the "browse all"
 * behind the feed's short list.
 *
 * Search is the site's own: the same adapter and scoring as the ⌘K overlay,
 * run over every published article rather than the feed's window, so a reader
 * finds an article by the same words in either place.
 */
export function ArticleBrowser({
  category,
  categories,
  series,
  onClose,
}: {
  /** Scopes the dialog to one category, as the feed it was opened from is. */
  category?: KeyStr;
  categories: readonly Category[];
  series: readonly Series[];
  onClose: () => void;
}) {
  const { searchAdapter } = useConfig();
  const { record } = useBeacon();
  const index = useQuery(blogIndexQuery(category));
  const [query, setQuery] = useState("");

  const blogs = index.data ?? NO_BLOGS;
  const adapter = useMemo(
    () => createSearchAdapter(searchAdapter, () => ({ blogs, categories, series })),
    [searchAdapter, blogs, categories, series],
  );
  const { hits, settled } = useSearchHits(adapter, query);

  const categoryLabels = useMemo(
    () => new Map(categories.map((entry) => [entry.key, entry.label])),
    [categories],
  );
  const seriesTitles = useMemo(
    () => new Map(series.map((entry) => [entry.id, entry.title])),
    [series],
  );

  const searching = query.trim() !== "";
  // The local adapter already searched only this category's index; a
  // server-side one searches everything, so its answer is narrowed here.
  const items = searching
    ? hits
        .map((hit) => hit.blog)
        .filter((blog) => !category || blog.category_keys.includes(category))
    : blogs;

  const label = category ? (categoryLabels.get(category) ?? category) : null;

  return (
    <ListDialog
      title={label ? `All articles · ${label}` : "All articles"}
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      searchLabel={label ? `Search ${label} articles` : "Search all articles"}
      status={index.data ? "ready" : index.isError ? "error" : "loading"}
      searching={searching && !settled}
      items={items}
      getKey={(blog) => blog.id}
      renderItem={(blog, position) => (
        <BlogCard
          blog={blog}
          variant="row"
          position={position}
          categoryLabels={categoryLabels}
          seriesTitle={blog.series_id ? seriesTitles.get(blog.series_id) : undefined}
          onSelect={(selected, at) =>
            record({
              kind: "click",
              blog_id: selected.id,
              position: at,
              source: searching ? "search" : "feed",
            })
          }
        />
      )}
      noun={["article", "articles"]}
      emptyMessage="Nothing published here yet."
      onRetry={() => void index.refetch()}
    />
  );
}
