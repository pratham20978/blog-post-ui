"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useConfig } from "@/app/providers/ConfigProvider";
import { useBeacon } from "@/app/providers/EngagementProvider";
import { cn } from "@/shared/lib/cn";
import { formatDateCompact, formatReadingTime } from "@/shared/lib/date";

import { createSearchAdapter, type SearchCorpus } from "../model/adapters";
import type { SearchHit } from "../model/port";

/**
 * The search overlay, opened from the header or with ⌘K / Ctrl-K.
 *
 * Mounted only while open — the parent renders it conditionally rather than
 * passing an `open` flag. That means closing it unmounts it and React discards
 * the query, results and cursor for free, instead of an effect having to reset
 * three pieces of state and stay in step with them.
 *
 * The adapter comes from config, so this component is identical whether
 * results are computed client-side or fetched from a real endpoint later.
 */
export function SearchDialog({
  onClose,
  corpus,
}: {
  onClose: () => void;
  corpus: SearchCorpus;
}) {
  const { searchAdapter } = useConfig();
  const { record } = useBeacon();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [active, setActive] = useState(0);

  const input = useRef<HTMLInputElement>(null);

  const adapter = useMemo(
    () => createSearchAdapter(searchAdapter, () => corpus),
    [searchAdapter, corpus],
  );

  const trimmed = query.trim();

  // Derived, not stored: with an empty box there are no results to show, and
  // clearing `hits` in an effect would be a second source of truth for the
  // same fact.
  const visible = trimmed ? hits : [];

  // Focus in, and focus back out on unmount. Both are DOM effects, which is
  // what effects are for.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => opener?.focus();
  }, []);

  // Debounced so a fast typist does not run a search per keystroke. Cheap for
  // the mock; essential once this is a network call.
  useEffect(() => {
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void adapter
        .search(trimmed, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return;
          setHits(results.hits);
          setActive(0);

          // What `query_id` and `SEARCH_IMPRESSION` were reserved for on the
          // engagement log.
          record({ kind: "search_impression", query_id: results.queryId, source: "search" });
        })
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        });
    }, 150);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, adapter, record]);

  const go = useCallback(
    (hit: SearchHit, position: number) => {
      record({ kind: "click", blog_id: hit.blog.id, position, source: "search" });
      onClose();
      router.push(`/blogs/${hit.blog.slug}`);
    },
    [record, onClose, router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      const hit = visible[active];
      if (hit) {
        event.preventDefault();
        go(hit, active);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-fg/20 px-4 pt-[10vh] backdrop-blur-sm"
      // The backdrop closes on click; the panel stops propagation, so a click
      // inside never reaches here.
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search articles"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-2xl border border-rule bg-bg shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-rule px-4">
          <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search articles"
            aria-label="Search articles"
            aria-controls="search-results"
            className="h-14 w-full bg-transparent text-[1.0625rem] outline-none placeholder:text-muted"
          />
          <kbd className="hidden shrink-0 border border-rule px-1.5 py-0.5 text-eyebrow text-muted sm:block">
            ESC
          </kbd>
        </div>

        <div id="search-results" className="max-h-[60vh] overflow-y-auto">
          {!trimmed ? (
            <p className="px-4 py-8 text-center text-[0.9375rem] text-muted">
              Search by title, summary, category or series.
            </p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.9375rem] text-muted">
              No articles match &ldquo;{trimmed}&rdquo;.
            </p>
          ) : (
            <ul>
              {visible.map((hit, index) => (
                <li key={hit.blog.id}>
                  <Link
                    href={`/blogs/${hit.blog.slug}`}
                    onClick={(event) => {
                      event.preventDefault();
                      go(hit, index);
                    }}
                    onMouseEnter={() => setActive(index)}
                    aria-current={index === active ? "true" : undefined}
                    className={cn(
                      "block border-b border-rule px-4 py-3 last:border-b-0",
                      index === active && "bg-surface-hover",
                    )}
                  >
                    <p className="text-[0.9375rem] font-medium text-fg">{hit.blog.title}</p>
                    <p className="mt-1 text-meta text-muted">
                      {formatDateCompact(hit.blog.published_at)} ·{" "}
                      {formatReadingTime(hit.blog.reading_minutes)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Announces the count without stealing focus from the input. */}
        <p aria-live="polite" className="sr-only">
          {trimmed
            ? `${visible.length} ${visible.length === 1 ? "result" : "results"} for ${trimmed}`
            : ""}
        </p>
      </div>
    </div>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
