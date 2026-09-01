/** Mirror of `src/blogs/contracts/interaction.py`. */

import type {
  AnchorStr,
  BlogId,
  CatalogId,
  CommentId,
  IsoDateTime,
  KeyStr,
  UserId,
} from "./common";

/**
 * Threads are exactly one level deep, and that is enforced structurally: a
 * composite foreign key makes a reply-to-a-reply unrepresentable in the
 * schema. `depth` is therefore only ever 0 or 1.
 *
 * `deleted_at` is a tombstone — a removed comment keeps its replies attached
 * rather than silently reshaping the thread.
 */
export interface Comment {
  readonly id: CommentId;
  readonly blog_id: BlogId;
  readonly user_id: UserId;
  readonly parent_comment_id: CommentId | null;
  /** 0 = root, 1 = reply. */
  readonly depth: number;
  /** 1–10 000 characters. */
  readonly body: string;
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
  readonly deleted_at: IsoDateTime | null;
}

/** The only shape a single-level thread can take. */
export interface CommentThread {
  readonly root: Comment;
  readonly replies: readonly Comment[];
}

/** The default: survives edits to the article, because it is tied to a
 *  heading rather than a character offset. */
export interface SectionAnchor {
  readonly kind: "section";
  readonly anchor: AnchorStr;
  readonly offset_in_section: number;
}

/** Fallback for an article with no headings. */
export interface OffsetAnchor {
  readonly kind: "offset";
  readonly char_offset: number;
}

/** A span rather than a point — a highlight. Present for the search feature
 *  that will reuse the shape; nothing stores highlights today. */
export interface RangeAnchor {
  readonly kind: "range";
  readonly start_anchor: AnchorStr;
  readonly start_offset: number;
  readonly end_anchor: AnchorStr;
  readonly end_offset: number;
}

export type MarkerAnchor = SectionAnchor | OffsetAnchor | RangeAnchor;

/** Where a reader stopped. One per user per article — placing it again moves
 *  it, which is why the route is a PUT. */
export interface Marker {
  readonly user_id: UserId;
  readonly blog_id: BlogId;
  readonly anchor: MarkerAnchor;
  /** 0–1. Stored beside the anchor so a "continue reading" list never has to
   *  interpret the anchor payload. */
  readonly progress_ratio: number | null;
  readonly updated_at: IsoDateTime;
}

/** A saved collection. Names are unique per user, case-insensitively. */
export interface Catalog {
  readonly id: CatalogId;
  readonly user_id: UserId;
  /** 1–120 characters. */
  readonly name: string;
  /** Created lazily the first time someone saves without naming a collection. */
  readonly is_default: boolean;
  readonly item_count: number;
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
}

export interface CatalogItem {
  readonly catalog_id: CatalogId;
  readonly blog_id: BlogId;
  readonly added_at: IsoDateTime;
  readonly note: string | null;
}

/** Keyed by actor, so anonymous visitors have recent views too — and keep
 *  them across signing in, because the merge rewrites the rows. */
export interface RecentView {
  readonly blog_id: BlogId;
  readonly title: string;
  readonly slug: KeyStr;
  readonly last_viewed_at: IsoDateTime;
  readonly view_count: number;
}

// ── Request DTOs ───────────────────────────────────────────────────────────

export interface CommentBody {
  readonly body: string;
  readonly parent_comment_id?: string | null;
}

export interface MarkerBody {
  readonly anchor: MarkerAnchor;
  readonly progress_ratio?: number | null;
}

export interface CatalogBody {
  readonly name: string;
}

export interface SaveBody {
  readonly blog_id: BlogId;
  readonly catalog_id?: string | null;
  readonly note?: string | null;
}
