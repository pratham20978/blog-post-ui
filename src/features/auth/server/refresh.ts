import "server-only";

import { API_PREFIX, apiOrigin } from "@/shared/config";
import { routes } from "@/shared/api/routes";
import type { APIResponse, TokenPair } from "@/shared/contracts";

/**
 * Exchanging a refresh token, exactly once per token.
 *
 * The backend's refresh token is **single-use, rotating, and family-tracked**:
 * spending one mints a replacement and burns the original, and presenting a
 * burned token is treated as theft — the whole family is revoked and every
 * session the user has is signed out.
 *
 * That makes concurrency the entire problem here. A page that fires four
 * requests through the BFF at once, all holding an expired access token, will
 * try to refresh four times with the same refresh token. One succeeds; the
 * other three replay a spent token and log the user out of everything. It
 * presents as "the app randomly signs me out", which is close to unfindable
 * after the fact.
 *
 * So refreshes are de-duplicated by token value: the first caller starts the
 * request, everyone else awaits the same promise and reads the same result.
 * A successful result is then held briefly so a request that was already in
 * flight when the rotation happened is served too — see `recentlyRotated`,
 * which is the half that is easy to leave out and expensive to be missing.
 *
 * **Scope.** Both maps are module-level, so they cover one Node process. Two
 * instances behind a load balancer can still collide, and the real fix for
 * that is a shared store keyed the same way. It is not worth one until this
 * runs on more than one instance — but it is a real limit, not an assumption
 * that happens to hold.
 */

/** Keyed on the refresh token itself: two different tokens are two different
 *  families and must not share a result. */
const inFlight = new Map<string, Promise<TokenPair | null>>();

/**
 * Results of recent successful refreshes, keyed by the token that was spent.
 *
 * De-duplicating only what is *currently* in flight is not enough, and the gap
 * is not theoretical. Consider two page loads a moment apart:
 *
 * ```
 * t=0ms   request A arrives with token1, starts a refresh
 * t=40ms  refresh succeeds, token1 spent, token2 issued, A's entry cleared
 * t=45ms  request B arrives — still carrying token1, because the browser had
 *         not yet received A's Set-Cookie when B was sent
 * ```
 *
 * With only an in-flight map, B refreshes with a token that is already spent.
 * The backend reads that as a stolen token, revokes the whole family, and the
 * user is signed out of every device. From the outside it looks like the app
 * randomly logs you out under load — which is close to undiagnosable, because
 * by the time anyone looks, the evidence is a revoked family with no cause.
 *
 * So a successful result is remembered briefly and replayed to anyone arriving
 * late with the token it replaced. They get the same valid pair A got, and the
 * spent token is never presented twice.
 */
const GRACE_MS = 60_000;

/** Bounded so a long-lived process cannot accumulate entries without limit.
 *  Far above any plausible number of concurrent refreshes. */
const MAX_GRACE_ENTRIES = 500;

const recentlyRotated = new Map<string, { pair: TokenPair; at: number }>();

/**
 * Spend a refresh token for a new pair, or `null` if it is no longer valid.
 *
 * `null` covers expiry, revocation and reuse alike. The caller's only sensible
 * response to any of them is the same — clear the cookies and treat the visitor
 * as signed out — so they are not distinguished here.
 */
export function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const rotated = recentlyRotated.get(refreshToken);
  if (rotated && Date.now() - rotated.at < GRACE_MS) {
    return Promise.resolve(rotated.pair);
  }

  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const attempt = exchange(refreshToken)
    .then((pair) => {
      if (pair) remember(refreshToken, pair);
      return pair;
    })
    .finally(() => {
      // Removed once settled. A later request with the same token now finds
      // the grace entry instead, which is the point.
      inFlight.delete(refreshToken);
    });

  inFlight.set(refreshToken, attempt);
  return attempt;
}

function remember(spent: string, pair: TokenPair): void {
  const now = Date.now();

  // Prune on write rather than on a timer: there is no scheduler here, and a
  // `setInterval` in a module would keep a serverless instance alive.
  for (const [token, entry] of recentlyRotated) {
    if (now - entry.at >= GRACE_MS) recentlyRotated.delete(token);
  }

  // Insertion-ordered, so the oldest is first. Only reachable if hundreds of
  // distinct sessions refresh inside one grace window.
  while (recentlyRotated.size >= MAX_GRACE_ENTRIES) {
    const oldest = recentlyRotated.keys().next();
    if (oldest.done) break;
    recentlyRotated.delete(oldest.value);
  }

  recentlyRotated.set(spent, { pair, at: now });
}

async function exchange(refreshToken: string): Promise<TokenPair | null> {
  let response: Response;

  try {
    response = await fetch(new URL(`${API_PREFIX}${routes.refresh()}`, apiOrigin()), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      // Credentials in, credentials out. Nothing on this path may be cached.
      cache: "no-store",
    });
  } catch {
    // The API is unreachable. Not evidence the token is bad, but there is
    // nothing to return and the caller cannot proceed either way.
    return null;
  }

  if (!response.ok) return null;

  try {
    const body = (await response.json()) as APIResponse<TokenPair>;
    return body.success && body.data ? body.data : null;
  } catch {
    return null;
  }
}
