"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

import { useIntersection } from "@/shared/lib/useInView";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Skeleton } from "./primitives";

/** Rows revealed per step — enough to overfill the panel, so the next step is
 *  always a scroll away rather than fired by the first. */
const PAGE_SIZE = 20;

export type ListDialogStatus = "loading" | "error" | "ready";

export interface ListDialogProps<T> {
  title: string;
  onClose: () => void;
  /** What has been typed. Filtering is the caller's job; `items` are shown as given. */
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
  status: ListDialogStatus;
  /** True while results for the current query are still on their way. */
  searching?: boolean;
  /** Already filtered for `query`. */
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** For the count line, e.g. `["article", "articles"]`. */
  noun: readonly [singular: string, plural: string];
  /** Shown when the list is empty before any search. */
  emptyMessage: ReactNode;
  onRetry?: () => void;
}

/**
 * A searchable list in a modal: the "view all" behind any list a page only
 * previews.
 *
 * Rows are revealed in steps as the reader scrolls — the next step arrives as
 * the end comes within reach — and a "Show more" button stays in the flow as
 * the keyboard and screen-reader route to the same thing. The items are
 * already in memory, so a step is a render, not a request.
 *
 * Pure presentation: the caller owns the data and the filtering, which is what
 * lets one component serve a reading history and the whole archive alike.
 */
export function ListDialog<T>({
  title,
  onClose,
  query,
  onQueryChange,
  searchLabel,
  status,
  searching = false,
  items,
  getKey,
  renderItem,
  noun,
  emptyMessage,
  onRetry,
}: ListDialogProps<T>) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  // Only where there is a precise pointer: on a phone, focusing the box would
  // raise the keyboard over the list the reader came to browse. Children's
  // effects run first, so the dialog is already open here.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);

  const [singular, plural] = noun;
  const countLine =
    status !== "ready"
      ? ""
      : searching
        ? "Searching…"
        : trimmed
          ? `${items.length} ${items.length === 1 ? "result" : "results"} for “${trimmed}”`
          : `${items.length} ${items.length === 1 ? singular : plural}`;

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="shrink-0 border-b border-rule px-5 pb-2 pt-3">
        <label htmlFor={inputId} className="sr-only">
          {searchLabel}
        </label>
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="h-5 w-5 shrink-0 text-muted"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              // A new search starts at the top, not wherever the last one was.
              if (body.current) body.current.scrollTop = 0;
            }}
            placeholder={searchLabel}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            // 16px: anything smaller makes iOS zoom the page on focus.
            className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted"
          />
        </div>
        <p aria-live="polite" className="min-h-5 text-meta text-muted">
          {countLine}
        </p>
      </div>

      <div
        ref={body}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin pb-[env(safe-area-inset-bottom)]"
      >
        {status === "loading" ? (
          <LoadingRows />
        ) : status === "error" ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[0.9375rem] text-muted">This list could not be loaded.</p>
            {onRetry && (
              <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        ) : items.length === 0 ? (
          !searching && (
            <p className="px-5 py-10 text-center text-[0.9375rem] text-muted">
              {trimmed ? <>Nothing matches &ldquo;{trimmed}&rdquo;.</> : emptyMessage}
            </p>
          )
        ) : (
          // Keyed by the query, so each search starts again from one step.
          <RevealList
            key={trimmed}
            items={items}
            getKey={getKey}
            renderItem={renderItem}
            root={body}
          />
        )}
      </div>
    </Dialog>
  );
}

function RevealList<T>({
  items,
  getKey,
  renderItem,
  root,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  root: RefObject<HTMLDivElement | null>;
}) {
  const [count, setCount] = useState(PAGE_SIZE);
  const list = useRef<HTMLUListElement>(null);
  const focusFrom = useRef<number | null>(null);

  // After the button is pressed, focus moves to the first new row, so a
  // keyboard or screen-reader user carries on where the list grew instead of
  // being left on a button that has just moved past everything new.
  useEffect(() => {
    const index = focusFrom.current;
    if (index === null) return;
    focusFrom.current = null;
    list.current?.children[index]
      ?.querySelector<HTMLElement>("a, button")
      ?.focus({ preventScroll: true });
  }, [count]);

  const reveal = (viaButton: boolean) => {
    if (viaButton) focusFrom.current = count;
    setCount((value) => value + PAGE_SIZE);
  };

  const shown = items.slice(0, count);
  const remaining = items.length - shown.length;

  return (
    <>
      <ul ref={list} className="divide-y divide-rule">
        {shown.map((item, index) => (
          <li key={getKey(item)} className="px-5">
            {renderItem(item, index)}
          </li>
        ))}
      </ul>

      {remaining > 0 && <MoreSentinel root={root} remaining={remaining} onReveal={reveal} />}
    </>
  );
}

function MoreSentinel({
  root,
  remaining,
  onReveal,
}: {
  root: RefObject<HTMLDivElement | null>;
  remaining: number;
  onReveal: (viaButton: boolean) => void;
}) {
  // Fires a little before the end is visible, so scrolling rarely meets it.
  const ref = useIntersection<HTMLDivElement>(
    (entry) => {
      if (entry.isIntersecting) onReveal(false);
    },
    { root, rootMargin: "0px 0px 240px 0px" },
  );

  return (
    <div ref={ref} className="px-5 py-4 text-center">
      <Button variant="ghost" size="sm" onClick={() => onReveal(true)}>
        Show more ({remaining} more)
      </Button>
    </div>
  );
}

function LoadingRows() {
  return (
    <div role="status">
      <span className="sr-only">Loading…</span>
      <ul className="divide-y divide-rule">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="flex items-center gap-4 px-5 py-3">
            <Skeleton className="hidden aspect-[16/9] w-28 shrink-0 sm:block" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
