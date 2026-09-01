import { NextResponse, type NextRequest } from "next/server";

import { COOKIE, cookieOptions } from "@/shared/api/cookies";
import { routes } from "@/shared/api/routes";
import { serverFetch } from "@/shared/api/server";
import type { TokenPair } from "@/shared/contracts";

/**
 * The OAuth landing page — a redirect the backend cannot perform itself.
 *
 * `GET /auth/oauth/{provider}/callback` returns the `TokenPair` **as JSON**.
 * It does not redirect, and the `redirect_path` signed into the state is never
 * read back (`oauth_flow_service.redirect_path_of` has no caller). Point the
 * provider straight at it and the user finishes signing in staring at a page
 * of raw JSON — with their tokens in the URL bar's page source.
 *
 * So this route stands in front of it. Set `BLOGS_OAUTH_REDIRECT_BASE_URL` to
 * this app's origin and the provider sends the browser here; this forwards the
 * exchange server-side, turns the tokens into httpOnly cookies, and redirects
 * into the app. The path deliberately mirrors the backend's own
 * (`/api/v1/auth/oauth/...`) so the two are interchangeable from the provider's
 * point of view and nothing in the backend needs changing.
 *
 * Dormant until a provider has credentials — `NEXT_PUBLIC_OAUTH_PROVIDERS`
 * offers no buttons before then — but it costs one file and it is the
 * difference between OAuth working and OAuth looking broken on the day the
 * client id is added.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const params = request.nextUrl.searchParams;

  const code = params.get("code");
  const state = params.get("state");

  // The provider itself refused — the user declined consent, most commonly.
  // Not an error to show a stack trace for; send them back to sign-in with
  // something readable.
  const providerError = params.get("error");
  if (providerError) {
    return redirectTo(request, "/login", { error: providerError });
  }

  if (!code || !state) {
    return redirectTo(request, "/login", { error: "invalid_response" });
  }

  let tokens: TokenPair;
  try {
    tokens = await serverFetch<TokenPair>(routes.oauthCallback(provider), {
      query: { code, state },
      // No cookies on the way out: the exchange is authenticated by `code` and
      // `state`, and the actor is carried in the state the backend signed.
      anonymous: true,
      cache: "no-store",
    });
  } catch {
    return redirectTo(request, "/login", { error: "exchange_failed" });
  }

  // `redirect_path` is dropped by the backend, so there is nothing to recover
  // it from here either. The feed is the honest default.
  const response = redirectTo(request, "/blogs");

  response.cookies.set(COOKIE.access, tokens.access_token, cookieOptions.access());
  response.cookies.set(COOKIE.refresh, tokens.refresh_token, cookieOptions.refresh());
  response.cookies.set(COOKIE.actor, tokens.actor_token, cookieOptions.actor());

  return response;
}

/** Same-origin only: the destination is always a literal path from this file,
 *  never anything a caller supplied, so no open redirect is reachable here. */
function redirectTo(
  request: NextRequest,
  path: string,
  query?: Record<string, string>,
): NextResponse {
  const url = new URL(path, request.nextUrl.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}
