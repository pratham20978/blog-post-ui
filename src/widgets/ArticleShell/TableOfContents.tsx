"use client";

import { useEffect, useState } from "react";

import type { BlogSection } from "@/shared/contracts";
import { cn } from "@/shared/lib/cn";

/**
 * Section navigation, built from the backend's stored anchors.
 *
 * The ids it links to are written onto the headings by `rehypeBackendAnchors`
 * from this same list, so the two cannot drift.
 */
export function TableOfContents({
  sections,
  className,
}: {
  sections: readonly BlogSection[];
  className?: string;
}) {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (sections.length === 0) return;

    const headings = sections
      .map((section) => document.getElementById(section.anchor))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) return;

    // The band is the top slice of the viewport: a heading counts as current
    // once it reaches the top, not when it first appears at the bottom.
    // Without that, scrolling down highlights the *next* section early.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActiveAnchor(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav aria-label="On this page" className={className}>
      <p className="text-eyebrow font-medium uppercase tracking-eyebrow text-muted">
        On this page
      </p>

      <ul className="mt-4 flex flex-col gap-2 border-l border-rule">
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
    </nav>
  );
}
