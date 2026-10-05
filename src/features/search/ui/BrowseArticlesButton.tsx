"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { blogIndexQuery } from "@/entities/blog/api/client";
import type { Category, KeyStr, Series } from "@/shared/contracts";
import { Button } from "@/shared/ui/Button";

import { ArticleBrowser } from "./ArticleBrowser";
import { SearchIcon } from "./SearchDialog";

/**
 * Opens the archive dialog from the end of the feed's short list.
 *
 * The index is prefetched the moment the reader points at or focuses the
 * button, so it is usually in hand by the time the dialog opens.
 */
export function BrowseArticlesButton({
  category,
  categories,
  series,
}: {
  category?: KeyStr;
  categories: readonly Category[];
  series: readonly Series[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const prefetch = () => void queryClient.prefetchQuery(blogIndexQuery(category));

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-haspopup="dialog"
        className="w-full sm:w-auto"
      >
        <SearchIcon className="h-4 w-4" />
        Browse all articles
      </Button>

      {/* Mounted only while open, so closing it discards the search. */}
      {open && (
        <ArticleBrowser
          category={category}
          categories={categories}
          series={series}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
