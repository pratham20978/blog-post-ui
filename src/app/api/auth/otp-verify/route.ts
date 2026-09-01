import { NextResponse } from "next/server";

import { demoAuthEnabled, demoCookie, demoUserFor } from "@/features/auth/server/demo-session";
import { COOKIE, cookieOptions } from "@/shared/api/cookies";
import { ApiError } from "@/shared/api/errors";
import { fail, ok } from "@/shared/api/responses";
import { routes } from "@/shared/api/routes";
import { serverFetch } from "@/shared/api/server";
import { DEMO_OTP_CODE } from "@/shared/config";
import type { TokenPair, User } from "@/shared/contracts";

/**
 * `POST /api/auth/otp-verify` — exchange a code for a session.
 *
 * A local route rather than a BFF passthrough, and the reason is the whole
 * point of it: the backend answers with a `TokenPair`, and those three tokens
 * must become httpOnly cookies *on the server*. Proxying the response would
 * hand them to the browser, where any script could read them — which is
 * exactly what the cookie scheme exists to prevent.
 *
 * Two modes:
 *
 * - **api** — forwards to `POST /auth/otp/verify` and writes the cookies. The
 *   dev bypass code, when one is configured, is just a code the *backend*
 *   accepts; nothing here knows or cares which one worked.
 * - **fixtures** — no backend exists, so `DEMO_OTP_CODE` signs in as an
 *   invented reader against invented articles.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "REQUEST_INVALID", "Expected a JSON body.");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email.includes("@")) {
    return fail(400, "REQUEST_INVALID", "Enter a valid email address.", {
      details: { fields: [{ field: "email", reason: "INVALID" }] },
    });
  }

  return demoAuthEnabled() ? demoSignIn(email, code) : apiSignIn(email, code);
}

/**
 * The real exchange.
 *
 * The actor token is sent so the backend can attribute everything this browser
 * read before signing in to the new account — the merge that makes a fresh
 * account not-cold. It arrives back rotated, and all three are written here.
 */
async function apiSignIn(email: string, code: string) {
  let tokens: TokenPair;

  try {
    tokens = await serverFetch<TokenPair>(routes.otpVerify(), {
      method: "POST",
      body: { email, code },
    });
  } catch (cause) {
    if (cause instanceof ApiError) {
      // Passed through rather than flattened: the client distinguishes a wrong
      // code from an expired one from a throttled one, and each needs a
      // different thing from the reader.
      const { safe_message, stage, retryability } = cause.envelope;
      return fail(cause.status, cause.category, safe_message, { stage, retryability });
    }

    return fail(502, "INTERNAL_ERROR", "Could not reach the API.", { stage: "ACCESS" });
  }

  const response = NextResponse.json({
    success: true as const,
    message: "Signed in.",
    data: null,
    error: null,
  });

  response.cookies.set(COOKIE.access, tokens.access_token, cookieOptions.access());
  response.cookies.set(COOKIE.refresh, tokens.refresh_token, cookieOptions.refresh());
  response.cookies.set(COOKIE.actor, tokens.actor_token, cookieOptions.actor());

  return response;
}

/** Sample mode: any address, the fixed code, an invented reader. */
function demoSignIn(email: string, code: string) {
  if (code !== DEMO_OTP_CODE) {
    // The same category and wording the backend uses for a wrong code — the
    // sample path should not teach a different vocabulary from the real one.
    return fail(400, "OTP_INVALID", "That code is not correct.", { stage: "AUTH" });
  }

  const cookie = demoCookie(email);
  const response = ok<User>(demoUserFor(email));
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}
