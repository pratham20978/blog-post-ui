/** Mirror of `src/blogs/contracts/identity.py` plus the auth router's DTOs. */

import type { ActorId, IsoDateTime, UserId } from "./common";

export type UserStatus = "active" | "suspended" | "deleted";

/** Only these two. A provider the backend has no credentials for answers 404
 *  `OAUTH_PROVIDER_UNKNOWN`, so the UI must not offer it. */
export type OAuthProviderName = "google" | "github";

/** Drives copy only — the backend flow is identical either way. */
export type AuthPurpose = "login" | "signup";

/**
 * Read-only over HTTP. There is no `PATCH /me`: `display_name` can only ever
 * arrive from an OAuth profile, and email cannot be changed. The profile
 * screen must not offer edit affordances the API cannot honour.
 */
export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly display_name: string | null;
  readonly is_admin: boolean;
  readonly status: UserStatus;
  readonly email_verified_at: IsoDateTime | null;
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
}

/**
 * Every caller has an `actor_id`, signed in or not — it is the subject of each
 * engagement row, which is what lets a visitor build reading history before
 * they have an account.
 */
export interface AnonymousPrincipal {
  readonly kind: "anonymous";
  readonly actor_id: ActorId;
}

export interface UserPrincipal {
  readonly kind: "user";
  readonly actor_id: ActorId;
  readonly user_id: UserId;
  readonly is_admin: boolean;
}

export type Principal = AnonymousPrincipal | UserPrincipal;

/**
 * `GET /auth/me` returns a `User` when signed in and a `Principal` otherwise.
 * The two are told apart by the presence of `kind`, which only `Principal`
 * carries.
 */
export type MeResponse = User | Principal;

export function isPrincipal(me: MeResponse): me is Principal {
  return "kind" in me;
}

export function isUser(me: MeResponse): me is User {
  return !("kind" in me);
}

/**
 * What every sign-in returns.
 *
 * These never reach the browser: the BFF writes all three into httpOnly
 * cookies. The type exists for the server-side proxy, not for client code.
 */
export interface TokenPair {
  /** JWT, 15 minutes. */
  readonly access_token: string;
  /** Opaque, single-use, rotating, 30 days. Replaying a spent one revokes the
   *  entire token family — so refresh must be single-flight. */
  readonly refresh_token: string;
  readonly token_type: "Bearer";
  /** Seconds until `access_token` expires. */
  readonly expires_in: number;
  /** 365 days. Must be echoed on every request or the visitor's history is
   *  orphaned. */
  readonly actor_token: string;
}

// ── Request / response DTOs on the auth router ─────────────────────────────

export interface OtpRequestBody {
  readonly email: string;
  readonly purpose: AuthPurpose;
}

/**
 * Deliberately free of anything that varies with account existence — returning
 * a different shape for a known address would make this an enumeration
 * oracle. The UI must not imply a difference either.
 */
export interface OtpRequestAccepted {
  /** ISO-8601, but `+00:00` rather than `Z` on this one endpoint. */
  readonly expires_at: string;
  readonly resend_after: string;
}

export interface OtpVerifyBody {
  readonly email: string;
  readonly code: string;
}

export interface RevokeBody {
  readonly refresh_token?: string | null;
  readonly all_devices: boolean;
}

export interface OAuthStartResponse {
  readonly authorization_url: string;
  readonly state: string;
}
