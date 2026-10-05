"use client";

import { useEffect, useRef } from "react";

import { useReadingPosition } from "@/features/marker/model/ReadingPositionProvider";
import type { BlogSection } from "@/shared/contracts";
import { cn } from "@/shared/lib/cn";

/** Room kept above and below the current entry when the list follows it. */
const FOLLOW_MARGIN_PX = 32;

/**
 * Section navigation, built from the backend's stored anchors.
 *
 * The ids it links to are written onto the headings by `rehypeBackendAnchors`
 * from this same list, so the two cannot drift.
 *
 * A long article's outline is taller than the screen, so the list scrolls on
 * its own: the caller caps the nav's height and the list takes whatever is left
 * under the label. `overscroll-contain` stops a wheel or swipe that reaches
 * either end of the list from carrying on into the article.
 */
export function TableOfContents({
  sections,
  className,
}: {
  sections: readonly BlogSection[];
  className?: string;
}) {
  const { activeAnchor } = useReadingPosition();
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the current section in sight as the article scrolls past it. Only
  // the list moves — `scrollIntoView()` would scroll the page too and fight
  // the reader — and only once the entry has left the visible band.
  useEffect(() => {
    const container = scroller.current;
    const current = container?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!container || !current) return;

    const view = container.getBoundingClientRect();
    const entry = current.getBoundingClientRect();
    const above = entry.top - view.top - FOLLOW_MARGIN_PX;
    const below = entry.bottom - view.bottom + FOLLOW_MARGIN_PX;
    if (above >= 0 && below <= 0) return;

    container.scrollTo({
      top: container.scrollTop + (above < 0 ? above : below),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [activeAnchor]);

  if (sections.length < 2) return null;

  return (
    <nav aria-label="On this page" className={cn("flex flex-col", className)}>
      <p className="shrink-0 text-eyebrow font-medium uppercase tracking-eyebrow text-muted">
        On this page
      </p>

      {/*
        The scroll box wraps the list rather than being it: the links' `-ml-px`
        rule overlaps the list's own border, and an overflow box clips
        everything outside its padding edge. The padding, cancelled by the
        negative margin, keeps focus rings from being clipped the same way.
      */}
      <div
        ref={scroller}
        className="-ml-1 mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin py-1 pl-1 pr-2"
      >
        <ul className="flex flex-col gap-2 border-l border-rule">
          {sections.map((section) => {
            const active = section.anchor === activeAnchor;

            return (
              <li key={section.anchor}>
                <a
                  href={`#${section.anchor}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "-ml-px block border-l py-0.5 text-meta transition-colors",
                    // Nested headings indent, so the document's shape is visible
                    // at a glance rather than a flat list.
                    section.level >= 3 ? "pl-6" : "pl-4",
                    active
                      ? "border-fg text-fg"
                      : "border-transparent text-muted hover:border-rule-strong hover:text-fg",
                  )}
                >
                  {section.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
