import type { BlogSummary } from "@/shared/contracts";

/**
 * The generated cover, for articles with no image.
 *
 * Deterministic from the slug so a given article always looks the same — a
 * cover that changed between the feed and the article page would read as two
 * different posts.
 */
export interface TypographicCover {
  /** Which way round to set it: ink on paper, or paper on ink. */
  readonly inverted: boolean;
  /** Shown large. The title is already beside it, so repeating it would just
   *  be the same words twice. */
  readonly initials: string;
}

export function typographicCover(blog: Pick<BlogSummary, "slug" | "title">): TypographicCover {
  return {
    inverted: hash(blog.slug) % 2 === 1,
    initials: initialsOf(blog.title),
  };
}

/** Up to two initials from the title's first words. */
function initialsOf(title: string): string {
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** FNV-1a. Small, dependency-free, and stable across runs — which is the only
 *  property that matters here. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
