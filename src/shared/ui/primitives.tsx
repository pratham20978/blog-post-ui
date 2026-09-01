import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * The small pieces the layouts are assembled from. They are here rather than
 * in a file each because none of them carries behaviour — every one is a
 * styled element, and splitting them across seven files would only add
 * imports.
 */

// ── Layout ────────────────────────────────────────────────────────────────

const container = cva("mx-auto w-full px-5 sm:px-8", {
  variants: {
    width: {
      /** Article body. The 68ch measure is what makes long-form readable. */
      prose: "max-w-[var(--measure)]",
      /** Default page width. */
      content: "max-w-[1200px]",
      /** Full-bleed grids and hero rows. */
      wide: "max-w-[1440px]",
    },
  },
  defaultVariants: { width: "content" },
});

export interface ContainerProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof container> {
  as?: ElementType;
}

export function Container({ as: Tag = "div", width, className, ...props }: ContainerProps) {
  return <Tag className={cn(container({ width }), className)} {...props} />;
}

/** A vertical band. The gap is the editorial rhythm, not an arbitrary margin. */
export function Section({
  className,
  as: Tag = "section",
  ...props
}: ComponentPropsWithoutRef<"section"> & { as?: ElementType }) {
  return <Tag className={cn("py-[var(--section-gap)]", className)} {...props} />;
}

/** The only divider in the system. */
export function Rule({ className, ...props }: ComponentPropsWithoutRef<"hr">) {
  return <hr className={cn("border-0 border-t border-rule", className)} {...props} />;
}

// ── Type ──────────────────────────────────────────────────────────────────

/** The small uppercase label above a title: `RESEARCH`, `FEATURED`. */
export function Eyebrow({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn(
        "text-eyebrow font-medium uppercase tracking-eyebrow text-muted",
        className,
      )}
      {...props}
    />
  );
}

/** A section title, as used above each rail on the feed. */
export function SectionHeading({
  className,
  children,
  action,
  ...props
}: ComponentPropsWithoutRef<"div"> & { action?: ReactNode }) {
  return (
    <div className={cn("mb-8 flex items-baseline justify-between gap-4", className)} {...props}>
      <h2 className="text-heading font-semibold tracking-title text-fg">{children}</h2>
      {action}
    </div>
  );
}

/** The `·`-separated metadata row: date, reading time, series position. */
export function MetaRow({
  items,
  className,
}: {
  items: readonly ReactNode[];
  className?: string;
}) {
  const shown = items.filter(Boolean);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted", className)}>
      {shown.map((item, index) => (
        // Index keys are correct here: this is a positional list of already-
        // rendered fragments with no identity of their own.
        <span key={index} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────

const chip = cva(
  [
    "inline-flex items-center h-8 px-3",
    "text-meta whitespace-nowrap rounded-control",
    "border transition-colors duration-150",
  ],
  {
    variants: {
      active: {
        true: "bg-accent text-accent-fg border-accent",
        false: "border-rule text-muted hover:border-fg-subtle hover:text-fg",
      },
    },
    defaultVariants: { active: false },
  },
);

export interface ChipLinkProps
  extends ComponentPropsWithoutRef<typeof Link>,
    VariantProps<typeof chip> {}

/** Category filters. A link, not a button — filtering changes the URL, so it
 *  must be shareable and survive a reload. */
export function ChipLink({ active, className, ...props }: ChipLinkProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(chip({ active }), className)}
      {...props}
    />
  );
}

/** Non-interactive label, for categories shown on a card. */
export function Tag({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center text-eyebrow uppercase tracking-eyebrow text-muted",
        className,
      )}
      {...props}
    />
  );
}

// ── Loading ───────────────────────────────────────────────────────────────

/**
 * A loading placeholder. `aria-hidden` because a screen reader should hear the
 * region's own busy state, not a description of grey rectangles.
 */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-surface-hover rounded-control", className)}
      {...props}
    />
  );
}

// ── Identity ──────────────────────────────────────────────────────────────

/**
 * Initial-only avatar. There is no avatar URL in the `User` contract, so
 * deriving a mark from the name is the honest option rather than showing a
 * placeholder image that implies one could be uploaded.
 */
export function Avatar({
  name,
  email,
  size = 32,
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const source = name?.trim() || email?.trim() || "?";
  const initial = source.charAt(0).toUpperCase();

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "bg-accent text-accent-fg font-medium leading-none select-none",
        className,
      )}
    >
      {initial}
    </span>
  );
}
