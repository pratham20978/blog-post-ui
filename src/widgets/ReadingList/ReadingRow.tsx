import Link from "next/link";

import type { IsoDateTime } from "@/shared/contracts";
import { formatRelative } from "@/shared/lib/date";

/** One article in a reader's own list — in progress, or recently read. */
export interface ReadingListEntry {
  /** The blog id; unique within a list. */
  readonly id: string;
  readonly title: string;
  readonly href: `/blogs/${string}`;
  /** When the reader last moved their place in it, or last opened it. */
  readonly at: IsoDateTime;
  /** 0–1 for an article in progress; null where progress does not apply. */
  readonly progress: number | null;
}

/**
 * A row of a reading list: the title, how long ago, and a hairline of progress
 * when there is any.
 *
 * Deliberately not a client component. The profile page renders the preview
 * rows on the server and the "View all" dialog renders the rest in the browser,
 * both from this one component.
 */
export function ReadingRow({ entry }: { entry: ReadingListEntry }) {
  return (
    <Link href={entry.href} className="group block py-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.9375rem] text-fg transition-colors group-hover:text-muted">
          {entry.title}
        </span>
        <span className="shrink-0 text-meta text-muted">{formatRelative(entry.at)}</span>
      </div>

      {entry.progress !== null && (
        <div
          className="mt-3 h-px w-full bg-rule"
          role="progressbar"
          aria-valuenow={Math.round(entry.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Reading progress for ${entry.title}`}
        >
          <div className="h-px bg-fg" style={{ width: `${entry.progress * 100}%` }} />
        </div>
      )}
    </Link>
  );
}
