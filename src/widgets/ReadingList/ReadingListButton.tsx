"use client";

import { useState } from "react";

import { matchesAllTokens } from "@/features/search/model/adapters";
import { ListDialog } from "@/shared/ui/ListDialog";

import { ReadingRow, type ReadingListEntry } from "./ReadingRow";

/**
 * "View all" for a reading list the profile only previews: every entry in a
 * dialog, filterable by title.
 *
 * The entries arrive whole with the page — the API already bounds these lists
 * (100 saved places, 50 recent reads) — so searching and scrolling cost no
 * requests.
 */
export function ReadingListButton({
  title,
  entries,
  searchLabel,
}: {
  title: string;
  entries: readonly ReadingListEntry[];
  searchLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        // The padding, cancelled by the margin, gives a small link a
        // touch-sized target without moving the heading it sits beside.
        className="-my-3 py-3 text-meta text-muted underline underline-offset-4 transition-colors hover:text-fg"
      >
        View all ({entries.length})
      </button>

      {/* Mounted only while open, so closing it discards the search. */}
      {open && (
        <ReadingListDialog
          title={title}
          entries={entries}
          searchLabel={searchLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ReadingListDialog({
  title,
  entries,
  searchLabel,
  onClose,
}: {
  title: string;
  entries: readonly ReadingListEntry[];
  searchLabel: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const items = entries.filter((entry) => matchesAllTokens(entry.title, query));

  return (
    <ListDialog
      title={title}
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      searchLabel={searchLabel}
      status="ready"
      items={items}
      getKey={(entry) => entry.id}
      renderItem={(entry) => <ReadingRow entry={entry} />}
      noun={["article", "articles"]}
      emptyMessage="Nothing here yet."
    />
  );
}
