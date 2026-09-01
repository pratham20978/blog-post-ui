import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { demoCookieName } from "@/features/auth/server/demo-session";
import { COOKIE, cookieOptions } from "@/shared/api/cookies";
import { routes } from "@/shared/api/routes";
import { serverFetch } from "@/shared/api/server";
import type { APIResponse } from "@/shared/contracts";

/**
 * `POST /api/auth/sign-out` — end the session.
 *
 * Two halves, and the order matters. The backend is told first, so the refresh
 * token is actually revoked server-side; then the cookies are cleared locally.
 * Doing it the other way round would drop the refresh token before it could be
 * revoked, leaving a valid credential alive for thirty days with nothing left
 * that could cancel it.
 *
 * Revocation is best-effort: if the API is unreachable the cookies are cleared
 * anyway. A sign-out that refuses to sign you out because the network is down
 * is the wrong failure — the local session is gone either way, and the tokens
 * expire on their own.
 *
 * The actor cookie is deliberately **kept**. It is not a credential; it is the
 * anonymous identity that owns this browser's reading history, and clearing it
 * would orphan everything read before signing in — precisely what the
 * merge-on-login exists to preserve.
 */
export async function POST(request: Request) {
  let allDevices = false;
  try {
    const body = (await request.json()) as { all_devices?: unknown };
    allDevices = body.all_devices === true;
  } catch {
    // No body is fine — it means "this device".
  }

  const jar = await cookies();
  const refresh = jar.get(COOKIE.refresh)?.value;

  // Only worth a call when there is something to revoke. In sample mode there
  // never is, so this is also what keeps that path from reaching for a backend
  // that is not running.
  if (refresh) {
    try {
      await serverFetch(routes.revoke(), {
        method: "POST",
        body: { refresh_token: refresh, all_devices: allDevices },
      });
    } catch {
      // See above: the local session is cleared regardless.
    }
  }

  const response = NextResponse.json<APIResponse<null>>({
    success: true,
    message: "Signed out.",
    data: null,
    error: null,
  });

  // All three cleared unconditionally, sample cookie included: sign-out must
  // never leave a credential behind because of which mode the site happens to
  // be running in, and expiring a cookie that was not set is harmless.
  response.cookies.set(COOKIE.access, "", cookieOptions.clear());
  response.cookies.set(COOKIE.refresh, "", cookieOptions.clear());
  response.cookies.set(demoCookieName, "", cookieOptions.clear());

  return response;
}
