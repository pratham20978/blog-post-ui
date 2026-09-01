import "server-only";

import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/**
 * Where the three backend tokens live.
 *
 * All httpOnly, so no script — ours or an injected one — can read them. That
 * is the whole reason the BFF proxy exists: the browser holds credentials it
 * cannot see, and a route handler attaches them server-side.
 */
export const COOKIE = {
  /** JWT, 15 minutes. */
  access: "blogs_at",
  /** Opaque, single-use, rotating, 30 days. The one worth protecting most:
   *  it is the only token that can mint new ones. */
  refresh: "blogs_rt",
  /** Anonymous actor identity, 365 days. Present for signed-out visitors too —
   *  it is what gives their reading history a subject before they have an
   *  account, and what the merge-on-login backfills from. */
  actor: "blogs_act",
} as const;

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
const ACTOR_MAX_AGE = 365 * 24 * 60 * 60;

type CookieOptions = Partial<ResponseCookie>;

function base(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    // `lax` rather than `strict`: the OAuth provider redirects the browser
    // back to us cross-site, and `strict` would withhold the cookies on that
    // navigation — the user would arrive signed out.
    sameSite: "lax",
    // Plain http on localhost would drop a `secure` cookie entirely.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export const cookieOptions = {
  access: () => base(ACCESS_MAX_AGE),
  refresh: () => base(REFRESH_MAX_AGE),
  actor: () => base(ACTOR_MAX_AGE),
  /** Expire immediately, for sign-out. */
  clear: (): CookieOptions => ({ ...base(0), maxAge: 0 }),
} as const;
