/** Mirror of `src/blogs/contracts/blog.py`. */

import type {
  AnchorStr,
  BlogId,
  IsoDateTime,
  KeyStr,
  PinId,
  SeriesId,
  UserId,
} from "./common";

export type BlogStatus = "draft" | "published" | "archived";

export interface Category {
  readonly key: KeyStr;
  readonly label: string;
  readonly description: string | null;
}

/**
 * Note what is absent: no status, no start or end date, no ordering.
 * "Current" and "upcoming" series are not backend concepts — they are derived
 * in `entities/blog/model/selectors.ts` from published data.
 */
export interface Series {
  readonly id: SeriesId;
  readonly key: KeyStr;
  readonly title: string;
  readonly description: string | null;
}

/**
 * One heading, extracted at publish time and stored in `blog_sections`.
 *
 * `anchor` is authoritative. Reference pins and section markers are validated
 * against it by a composite foreign key, so the rendered article must use
 * these exact strings rather than re-slugifying heading text — see
 * `shared/lib/markdown`.
 */
export interface BlogSection {
  readonly anchor: AnchorStr;
  readonly ordinal: number;
  /** 1–6. */
  readonly level: number;
  readonly title: string;
  /** Character offsets into the stored Markdown body. */
  readonly char_start: number;
  readonly char_end: number;
}

/** The list shape. No body, and no cover — see `shared/lib/cover`. */
export interface BlogSummary {
  readonly id: BlogId;
  readonly slug: KeyStr;
  readonly title: string;
  readonly summary: string | null;
  readonly status: BlogStatus;
  readonly series_id: SeriesId | null;
  readonly series_position: number | null;
  readonly category_keys: readonly KeyStr[];
  readonly word_count: number;
  /** Computed by the database at 238 wpm. Do not recompute it. */
  readonly reading_minutes: number;
  readonly published_at: IsoDateTime | null;
  readonly updated_at: IsoDateTime;
}

/** The read-one shape: metadata and structure, still not body text. */
export interface BlogDetail {
  readonly id: BlogId;
  readonly slug: KeyStr;
  readonly title: string;
  readonly summary: string | null;
  readonly status: BlogStatus;
  readonly author_id: UserId;
  readonly series_id: SeriesId | null;
  readonly series_position: number | null;
  readonly category_keys: readonly KeyStr[];
  readonly sections: readonly BlogSection[];
  /**
   * An internal `s3://bucket/key` URI, NOT a browser-fetchable URL. The body
   * comes from `GET /blogs/{slug}/content` and nowhere else.
   */
  readonly markdown_uri: string;
  /** 64-char lowercase hex. Doubles as the strong ETag on the content route. */
  readonly content_sha256: string;
  readonly word_count: number;
  readonly reading_minutes: number;
  readonly published_at: IsoDateTime | null;
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
}

/**
 * The article body.
 *
 * `markdown` is the stored `.md` byte-for-byte, with frontmatter already
 * stripped by the publish pipeline. There is no `cover:` or `tags:` key to
 * read here — they were parsed and discarded server-side.
 */
export interface BlogContent {
  readonly blog_id: BlogId;
  readonly slug: KeyStr;
  readonly content_sha256: string;
  readonly markdown: string;
}

/** An admin's pointer from one article to an exact section of another. */
export interface ReferencePin {
  readonly id: PinId;
  readonly source_blog_id: BlogId;
  readonly target_blog_id: BlogId;
  readonly target_anchor: AnchorStr;
  readonly note: string | null;
  readonly created_by: UserId;
  readonly created_at: IsoDateTime;
}

/** Query params for `GET /api/v1/blogs`. `status` is not among them: the feed
 *  serves published articles only, by design. */
export interface BlogListParams {
  readonly category?: KeyStr;
  readonly series_id?: SeriesId;
  readonly cursor?: string;
  /** 1–100. Defaults to 20 server-side. */
  readonly limit?: number;
}
