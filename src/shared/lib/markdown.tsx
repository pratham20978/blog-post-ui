import type { Route } from "next";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { BlogSection } from "@/shared/contracts";
import { cn } from "@/shared/lib/cn";

import { rehypeBackendAnchors } from "./rehype-backend-anchors";

/**
 * The rendered article body.
 *
 * One component, used wherever article Markdown appears. Everything about how
 * long-form copy reads on this platform is decided here: the serif face, the
 * 68-character measure applied by the container, the vertical rhythm between
 * blocks.
 *
 * Sanitised even though only an admin can publish. The Markdown arrives from
 * an object store rather than from the database, and a body that reaches the
 * page unsanitised is one storage misconfiguration away from being a script
 * injection point.
 */

/**
 * The sanitiser runs on author content only — see the plugin order below.
 *
 * Left at the defaults deliberately, including `clobberPrefix`: any `id` an
 * author writes in raw HTML gets namespaced or dropped, which is what stops an
 * element from shadowing a global via DOM clobbering.
 */
const schema = defaultSchema;

export function Article({
  markdown,
  sections,
  className,
}: {
  markdown: string;
  /** From `BlogDetail.sections`. Drives heading ids. */
  sections: readonly BlogSection[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-serif text-prose leading-prose text-fg",
        // Vertical rhythm is set here rather than per element so the spacing
        // between any two blocks is decided in one place.
        "[&>*+*]:mt-6",
        className,
      )}
    >
      {/*
        Plugin order is load-bearing: sanitise FIRST, then apply anchors.

        Reversed, `rehype-sanitize` rewrites our ids to `user-content-<anchor>`
        — its DOM-clobbering guard — and every table-of-contents link, deep
        link and section marker silently points at an element that no longer
        has that id. Running it first means it only ever sees author content,
        and the ids added afterwards are the backend's own, already constrained
        to `^[a-z0-9]+(-[a-z0-9]+)*$` by the contract.
      */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema], rehypeBackendAnchors(sections)]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Headings are sans — the serif is for reading, and a sans heading is what
 * signals the shift from prose to structure. `scroll-mt` keeps an anchored
 * heading clear of the sticky header.
 */
const components = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      {...props}
      className="mt-14 font-sans text-title font-semibold leading-title tracking-title scroll-mt-24"
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      {...props}
      className="mt-14 font-sans text-heading font-semibold leading-heading tracking-title scroll-mt-24"
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      {...props}
      className="mt-10 font-sans text-subheading font-semibold leading-heading scroll-mt-24"
    />
  ),
  h4: (props: ComponentPropsWithoutRef<"h4">) => (
    <h4 {...props} className="mt-8 font-sans text-base font-semibold scroll-mt-24" />
  ),

  p: (props: ComponentPropsWithoutRef<"p">) => <p {...props} />,

  a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => {
    const internal = href?.startsWith("/");

    if (internal) {
      // Internal links go through next/link so an article can cross-reference
      // another without a full page load.
      return (
        <Link
          // An author-written href. typedRoutes cannot verify a string that
          // only exists at runtime; the `startsWith("/")` guard above is the
          // real check, and a broken internal link is a 404, not a crash.
          href={href as Route}
          {...props}
          className="underline decoration-rule-strong underline-offset-[3px] transition-colors hover:decoration-fg"
        />
      );
    }

    return (
      <a
        href={href}
        // `noopener` is the one that matters — without it the opened page can
        // reach back through `window.opener`.
        target="_blank"
        rel="noopener noreferrer"
        {...props}
        className="underline decoration-rule-strong underline-offset-[3px] transition-colors hover:decoration-fg"
      />
    );
  },

  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul {...props} className="list-disc space-y-2 pl-6 marker:text-muted" />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol {...props} className="list-decimal space-y-2 pl-6 marker:text-muted" />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => <li {...props} className="pl-1" />,

  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      {...props}
      className="border-l-2 border-fg pl-6 italic text-fg-subtle [&>*+*]:mt-4"
    />
  ),

  // `pre` carries the frame and the scroll; `code` inside it must not repeat
  // the inline pill styling, hence the two are styled separately.
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      {...props}
      className="overflow-x-auto border border-rule bg-surface p-4 font-mono text-[0.875rem] leading-relaxed"
    />
  ),
  code: ({ className: codeClass, ...props }: ComponentPropsWithoutRef<"code">) => {
    // react-markdown marks fenced blocks with a `language-*` class; anything
    // without one is inline.
    const fenced = Boolean(codeClass?.startsWith("language-"));

    return fenced ? (
      <code {...props} className={cn("font-mono", codeClass)} />
    ) : (
      <code
        {...props}
        className="border border-rule bg-surface px-1.5 py-0.5 font-mono text-[0.875em]"
      />
    );
  },

  // Wrapped so a wide table scrolls inside its own box instead of forcing the
  // whole page sideways.
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto">
      <table {...props} className="w-full border-collapse font-sans text-[0.9375rem]" />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      {...props}
      className="border-b border-rule-strong px-3 py-2 text-left font-semibold"
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td {...props} className="border-b border-rule px-3 py-2 align-top" />
  ),

  hr: () => <hr className="my-12 border-0 border-t border-rule" />,

  img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => (
    <figure className="my-10">
      {/* Plain <img>: body images are arbitrary author URLs with unknown
          dimensions, and next/image needs either a size or a fill container.
          `loading="lazy"` covers the cost that matters here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={typeof src === "string" ? src : ""}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="w-full border border-rule"
      />
      {alt && (
        <figcaption className="mt-3 font-sans text-meta text-muted">{alt}</figcaption>
      )}
    </figure>
  ),
} as const;
