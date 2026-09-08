"use client";

import { useReadingPosition } from "@/features/marker/model/ReadingPositionProvider";
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
  const { activeAnchor } = useReadingPosition();

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
