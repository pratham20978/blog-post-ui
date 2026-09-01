import type { IsoDateTime } from "@/shared/contracts";

/**
 * Date handling for the platform.
 *
 * Everything is formatted in UTC. That is a deliberate choice, not an
 * oversight: the server sends UTC, and formatting in the viewer's zone means
 * the string rendered on the server differs from the one the browser produces,
 * which React reports as a hydration mismatch. A publication date is not
 * time-sensitive enough to be worth that.
 */

const DISPLAY = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const COMPACT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Parse a server timestamp.
 *
 * Handles both shapes the API emits: `2026-08-22T12:00:00Z` from every model
 * serialised by Pydantic, and `2026-08-22T12:00:00+00:00` from
 * `/auth/otp/request`, which pre-formats with `.isoformat()`.
 *
 * Returns null rather than an Invalid Date so callers cannot accidentally
 * render "Invalid Date" to a reader.
 */
export function parseInstant(value: IsoDateTime | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `April 8, 2026` — for article headers. */
export function formatDate(value: IsoDateTime | null | undefined): string {
  const date = parseInstant(value);
  return date ? DISPLAY.format(date) : "";
}

/** `Apr 8, 2026` — for cards and dense metadata rows. */
export function formatDateCompact(value: IsoDateTime | null | undefined): string {
  const date = parseInstant(value);
  return date ? COMPACT.format(date) : "";
}

/** The value for a `<time dateTime>` attribute: `2026-04-08`. */
export function toDateAttribute(value: IsoDateTime | null | undefined): string | undefined {
  const date = parseInstant(value);
  return date ? date.toISOString().slice(0, 10) : undefined;
}

/**
 * `4 min read`. The backend already computes `reading_minutes` at 238 wpm in a
 * generated column, so this only formats — it never recalculates.
 */
export function formatReadingTime(minutes: number): string {
  return `${Math.max(1, minutes)} min read`;
}

/**
 * Coarse relative time, for "recently read" lists where the exact instant does
 * not matter. Falls back to an absolute date beyond a month, because
 * "5 weeks ago" is harder to place than "Apr 8".
 */
export function formatRelative(
  value: IsoDateTime | null | undefined,
  now: Date = new Date(),
): string {
  const date = parseInstant(value);
  if (!date) return "";

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatDateCompact(value);
}
