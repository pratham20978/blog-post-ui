import "server-only";

import { cookies } from "next/headers";

import { API_PREFIX, apiOrigin } from "@/shared/config";
import type { APIResponse } from "@/shared/contracts";

import { COOKIE } from "./cookies";
import { ApiError, NetworkError } from "./errors";

/**
 * Server-side access to the backend, for Server Components and route handlers.
 *
 * This talks to FastAPI directly rather than going through the BFF proxy. Both
 * run on the server inside the same trust boundary, so a hop through the proxy
 * would only add a round trip. Client components use the BFF; server code uses
 * this.
 *
 * Auth headers are read from the request's cookies. There is no token refresh
 * here — a Server Component cannot set a cookie, so a rotated token would have
 * nowhere to go. Expired access tokens surface as `AUTH_TOKEN_EXPIRED`, and
 * the client retries through the BFF, which can write cookies.
 */

export interface ServerFetchOptions {
  method?: string;
  body?: unknown;
  /** Query parameters. Undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Next.js caching. Defaults to `no-store` for anything authenticated. */
  cache?: RequestCache;
  revalidate?: number | false;
  tags?: readonly string[];
  /** Skip reading cookies. Use for genuinely public, cacheable reads: a
   *  response varying by caller must not be shared in the data cache. */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: ServerFetchOptions["query"]): string {
  const url = new URL(`${API_PREFIX}${path}`, apiOrigin());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Call the backend and unwrap the envelope.
 *
 * Returns `data` directly. Every route wraps its payload in
 * `{success, message, data, error}`, so callers would otherwise reach through
 * `.data` on every line and have to null-check a field that is only null on
 * failure — which this already turns into a throw.
 */
export async function serverFetch<T>(
  path: string,
  options: ServerFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, query, cache, revalidate, tags, anonymous = false } = options;

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";

  if (!anonymous) {
    const jar = await cookies();
    const access = jar.get(COOKIE.access)?.value;
    const actor = jar.get(COOKIE.actor)?.value;

    if (access) headers.authorization = `Bearer ${access}`;
    // Sent even when signed in: the backend reads it to tie this browser's
    // pre-signup history to the account.
    if (actor) headers["X-Actor-Token"] = actor;
  }

  const next =
    revalidate !== undefined || tags
      ? { ...(revalidate !== undefined && { revalidate }), ...(tags && { tags: [...tags] }) }
      : undefined;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
      // Anything carrying a token must never land in a shared cache.
      ...(cache ? { cache } : !anonymous ? { cache: "no-store" as const } : {}),
      ...(next && { next }),
    });
  } catch (cause) {
    throw new NetworkError(`Could not reach the API at ${apiOrigin()}`, cause);
  }

  // 304 from the conditional content route: no body, and the caller already
  // holds the bytes.
  if (response.status === 304) {
    return undefined as T;
  }

  let payload: APIResponse<T>;
  try {
    payload = (await response.json()) as APIResponse<T>;
  } catch (cause) {
    // A non-JSON body means we did not reach the API we think we did — a proxy
    // error page, or the wrong origin entirely.
    throw new NetworkError(
      `API returned a non-JSON response (${response.status}) for ${path}`,
      cause,
    );
  }

  if (!payload.success || payload.error) {
    if (payload.error) throw new ApiError(payload.error, response.status);
    throw new NetworkError(`API reported failure without an error envelope for ${path}`);
  }

  return payload.data as T;
}

/**
 * Like `serverFetch`, but answers `null` instead of throwing.
 *
 * For data a page can render without — recent views, a marker, the session.
 * A failed sidebar should not take down the article it sits beside.
 */
export async function serverFetchOptional<T>(
  path: string,
  options: ServerFetchOptions = {},
): Promise<T | null> {
  try {
    return await serverFetch<T>(path, options);
  } catch {
    return null;
  }
}
