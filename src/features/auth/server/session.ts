import "server-only";

import { cookies } from "next/headers";

import { COOKIE } from "@/shared/api/cookies";
import { routes } from "@/shared/api/routes";
import { serverFetchOptional } from "@/shared/api/server";
import { isUser, type MeResponse } from "@/shared/contracts";

import type { Session } from "@/app/providers/AuthProvider";

import { readDemoSession } from "./demo-session";

/**
 * Resolve the caller's session on the server, for seeding `AuthProvider`.
 *
 * Runs on every request that renders the root layout, which is why it uses the
 * optional fetch: if the backend is down, the site should still serve cached
 * public articles. A browser with a refresh cookie remains in a neutral state
 * until the BFF can rotate or definitively reject it; a browser with no
 * refreshable credential safely degrades to signed out.
 */
export async function getServerSession(): Promise<Session> {
  // Sample mode only — see `demo-session.ts`. Returns null against the API, so
  // this cannot shadow a real session.
  const demo = await readDemoSession();
  if (demo) return { status: "authenticated", user: demo };

  const jar = await cookies();
  const hasAccess = Boolean(jar.get(COOKIE.access)?.value);
  const hasRefresh = Boolean(jar.get(COOKIE.refresh)?.value);

  // Only the BFF can rotate cookies. Seed a neutral state and let the client
  // probe through it instead of rendering a false signed-out state.
  if (hasRefresh && !hasAccess) return { status: "loading" };

  const me = await serverFetchOptional<MeResponse>(routes.me());

  if (!me) {
    return hasRefresh ? { status: "loading" } : { status: "anonymous", actorId: null };
  }

  // `/auth/me` answers for anonymous callers too, returning the actor rather
  // than a user — so the two are told apart by shape, not by status code.
  if (isUser(me)) return { status: "authenticated", user: me };

  return { status: "anonymous", actorId: me.actor_id };
}
