"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { BlogSection } from "@/shared/contracts";

interface ReadingPosition {
  readonly activeAnchor: string | null;
  readonly progressRatio: number;
  readonly hasReaderMoved: boolean;
}

const ReadingPositionContext = createContext<ReadingPosition | null>(null);

/** One observer for both navigation highlighting and marker persistence. */
export function ReadingPositionProvider({
  sections,
  children,
}: {
  sections: readonly BlogSection[];
  children: ReactNode;
}) {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [progressRatio, setProgressRatio] = useState(0);
  const [hasReaderMoved, setHasReaderMoved] = useState(false);

  useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.anchor))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length > 0) {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const initialFrame = window.requestAnimationFrame(() => {
        setActiveAnchor(
          headings.some((heading) => heading.id === hash) ? hash : headings[0]?.id ?? null,
        );
      });

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

      return observeProgress(
        () => setProgressRatio(readProgress()),
        () => {
          window.cancelAnimationFrame(initialFrame);
          observer.disconnect();
        },
        () => setHasReaderMoved(true),
      );
    }

    return observeProgress(
      () => setProgressRatio(readProgress()),
      undefined,
      () => setHasReaderMoved(true),
    );
  }, [sections]);

  const value = useMemo(
    () => ({ activeAnchor, progressRatio, hasReaderMoved }),
    [activeAnchor, progressRatio, hasReaderMoved],
  );

  return (
    <ReadingPositionContext.Provider value={value}>
      {children}
    </ReadingPositionContext.Provider>
  );
}

export function useReadingPosition(): ReadingPosition {
  const value = useContext(ReadingPositionContext);
  if (!value) {
    throw new Error("useReadingPosition must be used inside ReadingPositionProvider");
  }
  return value;
}

function observeProgress(
  update: () => void,
  cleanup?: () => void,
  onReaderMove?: () => void,
): () => void {
  let frame = 0;
  let lastReaderInput = Number.NEGATIVE_INFINITY;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  const noteReaderInput = () => {
    lastReaderInput = performance.now();
  };
  const keydown = (event: KeyboardEvent) => {
    if (
      ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(
        event.key,
      )
    ) {
      noteReaderInput();
    }
  };
  const scroll = () => {
    // Browser restoration, hash navigation and scripts can all cause scroll
    // events. Only treat the movement as reader initiated when it follows a
    // wheel, touch, or scrolling-key gesture.
    if (performance.now() - lastReaderInput <= 1_000) onReaderMove?.();
    schedule();
  };

  update();
  window.addEventListener("wheel", noteReaderInput, { passive: true });
  window.addEventListener("touchmove", noteReaderInput, { passive: true });
  window.addEventListener("keydown", keydown);
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    window.removeEventListener("wheel", noteReaderInput);
    window.removeEventListener("touchmove", noteReaderInput);
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("resize", schedule);
    if (frame) window.cancelAnimationFrame(frame);
    cleanup?.();
  };
}

function readProgress(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, window.scrollY / scrollable));
}
