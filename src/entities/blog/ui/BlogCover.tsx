import Image from "next/image";

import type { BlogSummary } from "@/shared/contracts";
import { cn } from "@/shared/lib/cn";
import { typographicCover, type DerivedCover } from "@/shared/lib/cover";

/**
 * The image on a card or at the top of an article.
 *
 * Two paths, and the second is not a degraded version of the first: when an
 * article's Markdown carries no image we set its initials large on a flat
 * field. On a black-and-white site that is a real cover, and it keeps the feed
 * from looking half-broken whenever an author writes a piece without a
 * diagram.
 */
export function BlogCover({
  blog,
  cover,
  className,
  sizes = "100vw",
  priority = false,
}: {
  blog: Pick<BlogSummary, "slug" | "title">;
  /** Extracted from the body upstream. Null renders the typographic cover. */
  cover?: DerivedCover | null;
  className?: string;
  /** Tell the browser the rendered width so it fetches the right file. */
  sizes?: string;
  /** Set only on the feed's lead image — it is the LCP element. */
  priority?: boolean;
}) {
  if (cover) {
    return (
      <div className={cn("relative overflow-hidden bg-surface", className)}>
        <Image
          src={cover.src}
          alt={cover.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }

  const { inverted, initials } = typographicCover(blog);

  return (
    <div
      // The title sits next to this in every layout, so announcing the
      // initials again would just repeat it.
      aria-hidden="true"
      className={cn(
        // `@container` so the initials scale with the card rather than the
        // viewport — the same component is a hero and a 200px rail thumbnail.
        "@container flex items-center justify-center overflow-hidden select-none",
        inverted ? "bg-fg text-bg" : "bg-surface text-fg border border-rule",
        className,
      )}
    >
      <span className="font-semibold tracking-display text-[clamp(2rem,12cqw,6rem)] leading-none">
        {initials}
      </span>
    </div>
  );
}
