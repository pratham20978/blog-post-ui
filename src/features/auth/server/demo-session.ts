import "server-only";

import { cookies } from "next/headers";

import { dataSource, DEMO_OTP_CODE } from "@/shared/config";
import type { User } from "@/shared/contracts";

export { DEMO_OTP_CODE };

/**
 * A stand-in signed-in session for sample mode.
 *
 * Real authentication is the backend's: an emailed code, verified server-side,
 * exchanged for a token pair. None of that can run with no backend, which left
 * every signed-in screen — profile, saves, the account menu — unreachable in
 * the mode the whole site is reviewed in.
 *
 * This closes that gap and nothing more. **It exists only when
 * `BLOGS_DATA_SOURCE` is `fixtures`**, where the articles are invented and
 * there is no real account to impersonate. In `api` mode every function here
 * refuses, so it can never stand in for a real credential — the guard is the
 * single reason this file is acceptable at all.
 */

const DEMO_COOKIE = "blogs_demo";

/** Sample mode only. Never true when reading from the API. */
export function demoAuthEnabled(): boolean {
  return dataSource() === "fixtures";
}

/**
 * Not a token and not pretending to be one: it carries an email in clear text
 * and is trivially forgeable. That is acceptable *because* it only unlocks
 * invented articles — and it is why this must stay behind `demoAuthEnabled`.
 */
export function demoUserFor(email: string): User {
  const handle = email.split("@")[0] ?? "reader";
  const name = handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    id: "0198f0e2-3b7a-7c31-9f52-0000000000de",
    email,
    display_name: name || "Reader",
    is_admin: false,
    status: "active",
    email_verified_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

export function demoCookie(email: string) {
  return {
    name: DEMO_COOKIE,
    value: encodeURIComponent(email),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    },
  };
}

export const demoCookieName = DEMO_COOKIE;

/** The signed-in demo user, or null. Always null outside sample mode. */
export async function readDemoSession(): Promise<User | null> {
  if (!demoAuthEnabled()) return null;

  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return null;

  const email = decodeURIComponent(raw);
  return email ? demoUserFor(email) : null;
}
