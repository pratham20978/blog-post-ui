import "server-only";

import { routes } from "@/shared/api/routes";
import { serverFetchOptional } from "@/shared/api/server";
import { isUser, type MeResponse } from "@/shared/contracts";

import type { Session } from "@/app/providers/AuthProvider";

import { readDemoSession } from "./demo-session";

/**
 * Resolve the caller's session on the server, for seeding `AuthProvider`.
 *
 * Runs on every request that renders the root layout, which is why it uses the
 * optional fetch: if the backend is down, the site should still serve its
 * cached articles to a signed-out reader rather than fail to render at all.
 * A reachability problem is not evidence that nobody is signed in, but
 * "anonymous" is the only safe assumption available, and it degrades to a
 * "Sign in" link rather than to a broken page.
 */
export async function getServerSession(): Promise<Session> {
  // Sample mode only — see `demo-session.ts`. Returns null against the API, so
  // this cannot shadow a real session.
  const demo = await readDemoSession();
  if (demo) return { status: "authenticated", user: demo };

  const me = await serverFetchOptional<MeResponse>(routes.me());

  if (!me) return { status: "anonymous", actorId: null };

  // `/auth/me` answers for anonymous callers too, returning the actor rather
  // than a user — so the two are told apart by shape, not by status code.
  if (isUser(me)) return { status: "authenticated", user: me };

  return { status: "anonymous", actorId: me.actor_id };
}
