"use client";

import { useTheme } from "@/app/providers/ThemeProvider";
import { cn } from "@/shared/lib/cn";

/**
 * Light/dark switch for the header.
 *
 * Which icon shows is decided in CSS from the `data-theme` attribute, not from
 * React state. The inline head script sets that attribute before first paint,
 * so the correct icon is in the very first frame — with no mounted flag, no
 * hydration mismatch, and no effect.
 *
 * Lives in `features/` rather than `shared/ui` because it reads a provider;
 * `shared/ui` stays pure so restyling it can never touch behaviour.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      // Static rather than "Switch to dark"/"Switch to light": the label is
      // rendered on the server, which cannot know the viewer's theme, and a
      // label that contradicted the icon would be worse than a general one.
      aria-label="Switch theme"
      title="Switch theme"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-control",
        "text-muted transition-colors hover:bg-surface-hover hover:text-fg",
        className,
      )}
    >
      <MoonIcon className="h-5 w-5 dark:hidden" />
      <SunIcon className="hidden h-5 w-5 dark:block" />
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
