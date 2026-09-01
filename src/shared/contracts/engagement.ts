/** Mirror of `src/blogs/contracts/engagement.py`. */

import type { BlogId } from "./common";

export type EngagementKind =
  | "impression"
  | "click"
  | "dwell"
  | "complete"
  | "save"
  | "share"
  | "comment"
  | "search_impression";

/** Where the interaction happened. Feeds the ranking work later. */
export type EngagementSource =
  | "feed"
  | "search"
  | "series"
  | "catalog"
  | "direct";

/**
 * The one client-writable engagement shape.
 *
 * Note what it does not have: `actor_id`, `user_id`, `occurred_at`. The server
 * sets all three, because a client that could set them could write engagement
 * as somebody else. `extra="forbid"` means sending them is a 400, not a
 * silently ignored field — so never spread a wider object into this type.
 */
export interface RecordEngagementCommand {
  readonly blog_id?: BlogId | null;
  readonly kind: EngagementKind;
  /** Zero-based position in the list the item was shown in. */
  readonly position?: number | null;
  /** Ties a `search_impression` to the query that produced it. */
  readonly query_id?: string | null;
  /** Milliseconds, capped at 86 400 000 (24h) server-side. */
  readonly dwell_ms?: number | null;
  /** 0–1. */
  readonly scroll_depth?: number | null;
  readonly source?: EngagementSource | null;
  /** Beacons are at-least-once, so a retry must not become a second row. The
   *  server namespaces this per actor. */
  readonly dedupe_key?: string | null;
}

/** `POST /engagement` answers 202 with this. A duplicate reports
 *  `recorded: false` rather than erroring — that is the normal case for
 *  at-least-once beacons, not a fault. */
export interface EngagementAccepted {
  readonly recorded: boolean;
}
