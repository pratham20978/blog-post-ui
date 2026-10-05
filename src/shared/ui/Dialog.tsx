"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * A modal on the native `<dialog>` element.
 *
 * Native rather than a positioned `<div>`, because `showModal()` gives for free
 * everything a hand-rolled overlay has to fake: the page behind becomes inert,
 * so focus cannot wander under the dialog; Escape closes it; it renders in the
 * top layer above the sticky header with no z-index to negotiate; and closing
 * returns focus to whatever opened it.
 *
 * Mount it only while it is open — the parent renders it conditionally, the
 * same convention as the header's search overlay — so closing discards any
 * state inside it.
 *
 * Every way out (Escape, the backdrop, the close button) goes through
 * `dialog.close()`, and only the resulting `close` event tells the parent. That
 * order is what lets the browser restore focus before the element unmounts.
 */
export function Dialog({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  /** Fires once the dialog has closed. The parent should unmount it. */
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    // Guarded: StrictMode runs this twice in development, and `showModal()` on
    // an open dialog throws. There is deliberately no cleanup that closes it —
    // closing fires `close`, which would unmount a dialog StrictMode is about
    // to reopen. Unmounting removes the element and its modal state with it.
    if (!dialog || dialog.open) return;

    // Measured while the page's scrollbar still exists: globals.css hides it
    // during a modal and pads the page by its width instead, so nothing behind
    // jumps sideways and no bare gutter shows beside the backdrop.
    const root = document.documentElement;
    root.style.setProperty("--scrollbar-width", `${window.innerWidth - root.clientWidth}px`);
    dialog.showModal();
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // The children fill the element, so a press whose target is the dialog
      // itself landed on the backdrop. Mouse-down rather than click: a text
      // selection dragged out of the search box must not close it.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className={cn(
        // Phone: a full-screen sheet. `dvh`, so mobile browser chrome cannot
        // hide the bottom of it.
        "m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-bg p-0 text-fg",
        // Wider screens: a panel hung from near the top that fits its content.
        // Hung rather than centred, so the search box stays put while the
        // results below it grow and shrink.
        "sm:mx-auto sm:mb-auto sm:mt-[8dvh] sm:h-fit sm:max-h-[84dvh] sm:w-[calc(100%-4rem)] sm:max-w-2xl sm:border sm:border-rule sm:shadow-lg",
        "backdrop:bg-fg/20 backdrop:backdrop-blur-sm",
        // Only while open: a closed dialog must keep the browser's display: none.
        "open:flex open:flex-col",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-rule py-2 pl-5 pr-2">
        <h2 id={titleId} className="truncate text-subheading font-semibold tracking-title text-fg">
          {title}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {children}
    </dialog>
  );
}
