import type { BlogSummary } from "@/shared/contracts";

/**
 * Cover images.
 *
 * The backend has no media field of any kind — no thumbnail, hero, or asset
 * column exists on `blogs`, and the publish pipeline strips frontmatter before
 * storing the body, so a `cover:` key would never survive to be read.
 *
 * That leaves exactly one source: the first image in the Markdown body. When
 * there is none, we generate a typographic cover instead of showing an empty
 * frame — on a black-and-white site a title set large on a flat field is a
 * legitimate cover, not a fallback that looks like a failure.
 */

export interface DerivedCover {
  readonly src: string;
  readonly alt: string;
}

/** Fenced and indented code, so an `![]()` inside a code sample is not
 *  mistaken for the article's cover. */
const FENCED_CODE = /^(?:```|~~~)[\s\S]*?^(?:```|~~~)\s*$/gm;

/** `![alt](url)` — optional title, and the URL may be wrapped in <>. */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/;

/** `<img src="...">`, which authors do use for sizing control. */
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i;
const HTML_IMAGE_ALT = /\balt\s*=\s*["']([^"']*)["']/i;

/**
 * Pull the first usable image out of a Markdown body.
 *
 * Only absolute http(s) URLs and root-relative paths are accepted. A relative
 * path like `./diagram.png` is meaningless to the browser: the Markdown was
 * authored against a repository layout, not against this site's URL space, so
 * rendering it would reliably 404.
 */
export function extractCover(markdown: string, fallbackAlt = ""): DerivedCover | null {
  if (!markdown) return null;

  const prose = markdown.replace(FENCED_CODE, "");

  const markdownMatch = MARKDOWN_IMAGE.exec(prose);
  const htmlMatch = HTML_IMAGE.exec(prose);

  // Whichever appears first in the document is the one the author led with.
  const useMarkdown =
    markdownMatch !== null &&
    (htmlMatch === null || markdownMatch.index < htmlMatch.index);

  if (useMarkdown && markdownMatch?.[2]) {
    const src = markdownMatch[2];
    return isRenderable(src) ? { src, alt: markdownMatch[1] || fallbackAlt } : null;
  }

  if (htmlMatch?.[1]) {
    const src = htmlMatch[1];
    if (!isRenderable(src)) return null;
    return { src, alt: HTML_IMAGE_ALT.exec(htmlMatch[0])?.[1] || fallbackAlt };
  }

  return null;
}

function isRenderable(src: string): boolean {
  if (src.startsWith("//") || src.startsWith("/")) return true;
  try {
    const { protocol } = new URL(src);
    // No `data:` — an inline blob in a Markdown body is almost always an
    // accident, and could be an SVG, which is a script vector.
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

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
