import type { OAuthProviderName } from "@/shared/contracts";

/**
 * Runtime configuration.
 *
 * `readServerConfig` runs on the server only and reads `process.env`. The
 * result is handed to `ConfigProvider` as a prop, so client components read it
 * from context rather than from `process.env` directly. That keeps every
 * environment lookup in one auditable place and makes config trivially
 * stubbable in tests.
 */

/**
 * Search has no backend endpoint yet.
 *
 * `none` answers every query with an empty result and says so — the honest
 * default while the feature does not exist. `mock` filters the cached feed
 * client-side, which is useful for demos but requires holding the whole feed in
 * memory on every page. `http` targets `GET /api/v1/search` once it exists.
 */
export type SearchAdapterKind = "none" | "mock" | "http";

/**
 * Where article data comes from.
 *
 * `api` talks to FastAPI and is the default. `fixtures` renders the whole site
 * from typed sample data with no backend running — which is what let the design
 * be built and reviewed before the API existed, and is now opt-in.
 *
 * The default points at the API deliberately. A missing or misspelt value
 * should surface as "the API is unreachable", which is a fixable error, rather
 * than as a site quietly serving invented articles — which looks like it works
 * and is much worse.
 */
export type DataSource = "fixtures" | "api";

export interface AppConfig {
  readonly siteName: string;
  readonly siteUrl: string;
  readonly searchAdapter: SearchAdapterKind;
  readonly dataSource: DataSource;
  /** Only providers the backend actually has credentials for. Offering one it
   *  lacks produces a 404 `OAUTH_PROVIDER_UNKNOWN` at the worst moment. */
  readonly oauthProviders: readonly OAuthProviderName[];
  /** The code accepted in place of an emailed one, or null when sign-in
   *  requires a real code. Shown on the code screen when present. */
  readonly devOtpCode: string | null;
}

/**
 * Read on the server by the data layer, which cannot use React context.
 *
 * Deliberately NOT a `NEXT_PUBLIC_` variable. Those are inlined into the
 * bundle at build time, which would bake the choice into the artifact — the
 * same build could not be pointed at fixtures in review and at the API in
 * production. This is read at request time on the server and reaches the
 * browser through `ConfigProvider` as a value, not as an environment lookup.
 */
export function dataSource(): DataSource {
  return process.env.BLOGS_DATA_SOURCE === "fixtures" ? "fixtures" : "api";
}

/** Server-side only. Calling this from a client component is a build error in
 *  practice, because `process.env` is not populated there. */
export function readServerConfig(): AppConfig {
  // Defaults to none. Offering a provider the backend has no credentials for
  // produces a 404 `OAUTH_PROVIDER_UNKNOWN` at the worst possible moment —
  // after the user has committed to signing in — so the buttons appear only
  // once this names a provider that actually works.
  const providers = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is OAuthProviderName => value === "google" || value === "github");

  const adapter = process.env.NEXT_PUBLIC_SEARCH_ADAPTER;

  return {
    siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Canerly",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    searchAdapter: adapter === "http" || adapter === "mock" ? adapter : "none",
    dataSource: dataSource(),
    oauthProviders: providers,
    devOtpCode: devOtpCode(),
  };
}

/**
 * The sign-in code accepted in place of an emailed one, or null.
 *
 * Read from the server so the code screen can tell the reader what to type.
 * It is not a secret — it is a development convenience, and the guard that
 * makes it safe lives in the backend, which refuses to start in production
 * with `BLOGS_OTP_DEV_BYPASS_CODE` set.
 *
 * Mirrored here rather than inferred: the frontend showing a code the backend
 * would reject is worse than showing nothing, so both read the same variable.
 */
export function devOtpCode(): string | null {
  if (dataSource() === "fixtures") return DEMO_OTP_CODE;
  return process.env.BLOGS_OTP_DEV_BYPASS_CODE || null;
}

/**
 * The backend origin. Server-side only, and deliberately not `NEXT_PUBLIC_`:
 * the browser never talks to FastAPI directly, it goes through the BFF proxy.
 */
export function apiOrigin(): string {
  return process.env.BLOGS_API_URL ?? "http://localhost:8000";
}

/** Everything the backend serves lives under this prefix. */
export const API_PREFIX = "/api/v1";

/**
 * The sign-in code accepted in sample mode, with any email address.
 *
 * Lives here rather than in `features/auth/server/demo-session.ts` so the code
 * screen can show it to the reviewer — that module is `server-only`. It is a
 * constant, not a secret: it unlocks invented articles and only when
 * `BLOGS_DATA_SOURCE=fixtures`, which is the guard that makes it safe.
 */
export const DEMO_OTP_CODE = "000000";
