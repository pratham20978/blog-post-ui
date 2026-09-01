import { NextResponse, type NextRequest } from "next/server";

import { refreshTokens } from "@/features/auth/server/refresh";
import { COOKIE, cookieOptions } from "@/shared/api/cookies";
import { fail } from "@/shared/api/responses";
import { API_PREFIX, apiOrigin } from "@/shared/config";
import type { APIResponse } from "@/shared/contracts";

/**
 * The only path from the browser to FastAPI.
 *
 * It exists because of one constraint: the access, refresh and actor tokens
 * live in httpOnly cookies, which is what stops any script — ours or one
 * injected into the page — from reading them. The browser therefore holds
 * credentials it cannot see and cannot attach, so something server-side has to
 * attach them. A `rewrite` in `next.config.ts` cannot: it forwards the request
 * verbatim, tokens and all, which is to say without any.
 *
 * Three jobs, in order of how quietly they fail if missed:
 *
 * 1. **Attach the tokens** on the way out.
 * 2. **Write back a rotated actor token** on the way in. This is the only place
 *    an anonymous visitor's identity can be established at all — a Server
 *    Component cannot set a cookie, so `serverFetch` can never do it. Without
 *    this every request is a new actor, reading history never accumulates, and
 *    the merge-on-sign-in that backfills it has nothing to merge. Nothing
 *    breaks visibly; the feature just never works.
 * 3. **Refresh and replay** on an expired access token, exactly once, with
 *    concurrent callers sharing one refresh — see `refresh.ts` for why that
 *    matters more than it looks.
 *
 * It also removes CORS from the picture. The backend only enables CORS when
 * `BLOGS_DEBUG=true` (`src/blogs/main.py`), so a browser talking to FastAPI
 * directly would break the moment debug was turned off. Here the browser only
 * ever talks to its own origin.
 */

/** Hop-by-hop and connection headers. Forwarding these corrupts the proxied
 *  request: `host` addresses the wrong server, and `content-length` describes
 *  a body `fetch` is about to re-encode. */
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "cookie",
  // Never forwarded from the client: this proxy decides what the caller's
  // credentials are, and a client-supplied one would be an impersonation.
  "authorization",
  "x-actor-token",
]);

/** Response headers that describe the hop, not the payload. `content-encoding`
 *  and `content-length` in particular describe bytes `fetch` has already
 *  decoded for us. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "set-cookie",
]);

const ACTOR_HEADER = "x-actor-token";

interface Forwarded {
  readonly response: Response;
  readonly body: ArrayBuffer;
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;

  // `..` would escape the `/api/v1` prefix and could reach the admin surface,
  // which is mounted under a secret path on the same origin. The prefix is the
  // whole security boundary of this proxy, so it is enforced rather than
  // assumed.
  if (path.some((segment) => segment === "." || segment === "..")) {
    return fail(400, "REQUEST_INVALID", "Invalid path.");
  }

  const target = new URL(
    `${API_PREFIX}/${path.map(encodeURIComponent).join("/")}`,
    apiOrigin(),
  );
  target.search = request.nextUrl.search;

  // Buffered rather than streamed, because a replay after a refresh has to
  // send the same body a second time and a stream can only be read once.
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const jar = request.cookies;
  const access = jar.get(COOKIE.access)?.value;
  const refresh = jar.get(COOKIE.refresh)?.value;
  const actor = jar.get(COOKIE.actor)?.value;

  let attempt: Forwarded;
  try {
    attempt = await forward(request, target, body, { access, actor });
  } catch {
    return fail(502, "INTERNAL_ERROR", "Could not reach the API.", { stage: "ACCESS" });
  }

  // Evaluated once, against the *first* attempt. Re-testing after the replay
  // would ask a different question: the replay's own 401 means the new token
  // was rejected too, and refreshing again from there is a loop.
  const expired = refresh !== undefined && (await isExpiredAccessToken(attempt));
  let rotatedTokens: Awaited<ReturnType<typeof refreshTokens>> = null;

  if (expired) {
    rotatedTokens = await refreshTokens(refresh);

    if (rotatedTokens) {
      try {
        attempt = await forward(request, target, body, {
          access: rotatedTokens.access_token,
          actor: rotatedTokens.actor_token,
        });
      } catch {
        return fail(502, "INTERNAL_ERROR", "Could not reach the API.", { stage: "ACCESS" });
      }
    }
  }

  const response = new NextResponse(attempt.body, {
    status: attempt.response.status,
    statusText: attempt.response.statusText,
    headers: copyResponseHeaders(attempt.response.headers),
  });

  if (rotatedTokens) {
    response.cookies.set(COOKIE.access, rotatedTokens.access_token, cookieOptions.access());
    response.cookies.set(COOKIE.refresh, rotatedTokens.refresh_token, cookieOptions.refresh());
  } else if (expired) {
    // The refresh token itself is spent, expired or revoked. Clearing the pair
    // is what turns "every request 401s forever" into a visible signed-out
    // state the user can act on. The actor cookie stays: it is not a
    // credential, and dropping it would orphan their reading history.
    response.cookies.set(COOKIE.access, "", cookieOptions.clear());
    response.cookies.set(COOKIE.refresh, "", cookieOptions.clear());
  }

  // Job 2. Written after the refresh branch so a rotation from the replayed
  // request wins over the one the first attempt returned.
  const issuedActor = attempt.response.headers.get(ACTOR_HEADER);
  if (issuedActor && issuedActor !== actor) {
    response.cookies.set(COOKIE.actor, issuedActor, cookieOptions.actor());
  }

  return response;
}

async function forward(
  request: NextRequest,
  target: URL,
  body: ArrayBuffer | undefined,
  credentials: { access?: string; actor?: string },
): Promise<Forwarded> {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }

  if (credentials.access) headers.set("authorization", `Bearer ${credentials.access}`);
  // Sent even when signed in: the backend reads it to attribute this browser's
  // pre-signup history to the account.
  if (credentials.actor) headers.set("x-actor-token", credentials.actor);

  const response = await fetch(target, {
    method: request.method,
    headers,
    ...(body !== undefined && body.byteLength > 0 && { body }),
    redirect: "manual",
    // Every response here is either per-caller or a credential exchange.
    // Nothing on this path may be cached.
    cache: "no-store",
  });

  return { response, body: await response.arrayBuffer() };
}

/**
 * Whether this failure is specifically an expired access token.
 *
 * Keyed on the error *category*, never the status: a 401 is also how an
 * invalid or revoked token answers, and refreshing on those would spend a
 * perfectly good refresh token to fix a problem it cannot fix.
 */
async function isExpiredAccessToken({ response, body }: Forwarded): Promise<boolean> {
  if (response.status !== 401) return false;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as APIResponse<unknown>;
    return parsed.error?.category === "AUTH_TOKEN_EXPIRED";
  } catch {
    return false;
  }
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const [key, value] of source) {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  return headers;
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
};
