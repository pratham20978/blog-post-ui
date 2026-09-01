import { demoAuthEnabled, readDemoSession } from "@/features/auth/server/demo-session";
import { fail, ok } from "@/shared/api/responses";
import type { MeResponse } from "@/shared/contracts";

/**
 * `GET /api/auth/me` — the session, for sample mode.
 *
 * In `api` mode the browser reads `/auth/me` through the BFF instead, so this
 * route refuses rather than answering: two sources of truth for who you are is
 * how a UI ends up showing one identity and acting as another.
 */
export async function GET() {
  if (!demoAuthEnabled()) {
    return fail(
      501,
      "INTERNAL_ERROR",
      "Not available outside sample mode — the real session comes through the BFF.",
      { stage: "AUTH" },
    );
  }

  const user = await readDemoSession();

  return ok<MeResponse>(
    user ?? { kind: "anonymous", actor_id: "0198f0e2-3b7a-7c31-9f52-0000000000ac" },
    { headers: { "cache-control": "no-store" } },
  );
}
