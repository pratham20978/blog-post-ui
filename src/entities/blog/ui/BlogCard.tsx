import Link from "next/link";

import type { BlogSummary } from "@/shared/contracts";
import { cn } from "@/shared/lib/cn";
import type { DerivedCover } from "@/shared/lib/cover";
import { formatDateCompact, formatReadingTime, toDateAttribute } from "@/shared/lib/date";
import { Eyebrow, MetaRow } from "@/shared/ui/primitives";

import { BlogCover } from "./BlogCover";

export type BlogCardVariant = "feature" | "split" | "compact";

export interface BlogCardProps {
  blog: BlogSummary;
  variant?: BlogCardVariant;
  /** Derived upstream from the Markdown body; null renders a typographic cover. */
  cover?: DerivedCover | null;
  /** Category keys resolved to human labels. Unmapped keys are skipped rather
   *  than shown raw — `open-source` in a card reads as a bug. */
  categoryLabels?: ReadonlyMap<string, string>;
  seriesTitle?: string;
  /** Overrides the category eyebrow. Used for `FEATURED`. */
  eyebrow?: string;
  /** Zero-based feed position, forwarded to the click beacon. */
  position?: number;
  /** Fires on click, for engagement. Presentation stays free of the API. */
  onSelect?: (blog: BlogSummary, position?: number) => void;
  /** Set on the feed's lead card only. */
  priority?: boolean;
  className?: string;
}

/**
 * Every article card in the platform.
 *
 * Three variants off one props contract, so a card is never written twice and
 * a change to the metadata row lands everywhere at once:
 *
 *   feature   full width, cover above — the lead article
 *   split     70% cover / 30% metadata — the main feed
 *   compact   small, stacked — series rails and sidebars
 *
 * Pure presentation: it receives its cover and its labels and renders them. It
 * does no fetching, so restyling it cannot break any data path.
 */
export function BlogCard({
  blog,
  variant = "split",
  cover,
  categoryLabels,
  seriesTitle,
  eyebrow,
  position,
  onSelect,
  priority = false,
  className,
}: BlogCardProps) {
  // Inlined at each use rather than hoisted to a const: typedRoutes checks
  // the literal type, and a `string` const would erase it.
  const href = `/blogs/${blog.slug}` as const;

  const label =
    eyebrow ??
    blog.category_keys
      .map((key) => categoryLabels?.get(key))
      .find((value): value is string => Boolean(value));

  const meta = [
    blog.published_at ? (
      <time key="date" dateTime={toDateAttribute(blog.published_at)}>
        {formatDateCompact(blog.published_at)}
      </time>
    ) : null,
    formatReadingTime(blog.reading_minutes),
    seriesTitle && blog.series_position
      ? `${seriesTitle} · ${blog.series_position}`
      : seriesTitle,
  ].filter(Boolean);

  // One anchor wraps the whole card, so the entire surface is the target and
  // there is exactly one tab stop — rather than separate links on the image
  // and the title, which double the keyboard cost of every card.
  const handleClick = onSelect ? () => onSelect(blog, position) : undefined;

  if (variant === "feature") {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={cn("group block", className)}
      >
        {/*
          The lead card shows a cover only when the article actually has one.
          A generated typographic cover works at card size, but at full width
          it is a 1200px slab of flat colour that reads as a failed image
          rather than as design — so an article with no image leads with its
          title instead, which is the stronger editorial choice anyway.
        */}
        {cover && (
          <BlogCover
            blog={blog}
            cover={cover}
            priority={priority}
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="aspect-[16/9] w-full"
          />
        )}

        <div className={cn("max-w-3xl", cover && "mt-6")}>
          {label && <Eyebrow>{label}</Eyebrow>}
          <h2 className="mt-3 text-display font-semibold leading-display tracking-display text-fg transition-colors group-hover:text-fg-subtle">
            {blog.title}
          </h2>
          {blog.summary && (
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">{blog.summary}</p>
          )}
          <MetaRow items={meta} className="mt-4" />
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={cn("group block", className)}
      >
        <BlogCover
          blog={blog}
          cover={cover}
          sizes="(min-width: 768px) 320px, 80vw"
          className="aspect-[16/9] w-full"
        />
        <div className="mt-4">
          {label && <Eyebrow>{label}</Eyebrow>}
          <h3 className="mt-2 text-[1.0625rem] font-semibold leading-snug tracking-title text-fg transition-colors group-hover:text-fg-subtle">
            {blog.title}
          </h3>
          <MetaRow items={meta} className="mt-2" />
        </div>
      </Link>
    );
  }

  // split — 70/30. Stacks on small screens, where a 30% metadata column would
  // be a few characters wide.
  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "group grid gap-5 sm:gap-8",
        "sm:grid-cols-[7fr_3fr] sm:items-start",
        className,
      )}
    >
      <BlogCover
        blog={blog}
        cover={cover}
        sizes="(min-width: 640px) 65vw, 100vw"
        className="aspect-[16/9] w-full"
      />

      <div className="sm:pt-1">
        {label && <Eyebrow>{label}</Eyebrow>}
        <h3 className="mt-2 text-title font-semibold leading-title tracking-title text-fg transition-colors group-hover:text-fg-subtle sm:text-heading">
          {blog.title}
        </h3>
        {blog.summary && (
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted line-clamp-3">
            {blog.summary}
          </p>
        )}
        <MetaRow items={meta} className="mt-4" />
      </div>
    </Link>
  );
}
