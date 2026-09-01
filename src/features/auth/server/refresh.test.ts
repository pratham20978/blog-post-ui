import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TokenPair } from "@/shared/contracts";

/**
 * The refresh lock, tested because its failure mode is invisible.
 *
 * A broken lock does not throw and does not fail a request — it spends a
 * single-use refresh token twice, the backend reads that as theft, and the
 * user is signed out of every device some time later. Nothing in the logs
 * points back at the cause. So the invariant worth asserting is not "refresh
 * works" but "the backend was called exactly once".
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function pair(suffix: string): TokenPair {
  return {
    access_token: `access-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    token_type: "Bearer",
    expires_in: 900,
    actor_token: `actor-${suffix}`,
  };
}

function respondWith(data: TokenPair, delayMs = 0): Promise<Response> {
  const body = JSON.stringify({ success: true, message: "OK", data, error: null });
  const response = new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  return delayMs === 0
    ? Promise.resolve(response)
    : new Promise((resolve) => setTimeout(() => resolve(response), delayMs));
}

/** Re-imported per test so the module-level maps start empty — they are
 *  process-wide state by design, which is exactly what needs isolating. */
async function loadModule() {
  vi.resetModules();
  return import("./refresh");
}

describe("refreshTokens", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the backend once for concurrent callers holding the same token", async () => {
    const { refreshTokens } = await loadModule();
    fetchMock.mockImplementation(() => respondWith(pair("new"), 20));

    const results = await Promise.all(
      Array.from({ length: 8 }, () => refreshTokens("token-1")),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Every caller must get the same pair, or the ones that missed out would
    // write a stale token back into the cookie.
    for (const result of results) expect(result).toEqual(pair("new"));
  });

  it("serves a late arrival still holding the token that was just spent", async () => {
    const { refreshTokens } = await loadModule();
    fetchMock.mockImplementation(() => respondWith(pair("new")));

    // The first request completes, so the in-flight entry is gone.
    await refreshTokens("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A request that was already in the air arrives with the old token. It
    // must NOT reach the backend: presenting a spent token is what trips
    // reuse-detection and revokes the whole family.
    const late = await refreshTokens("token-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(late).toEqual(pair("new"));
  });

  it("stops serving from grace once the window has passed", async () => {
    const { refreshTokens } = await loadModule();
    fetchMock.mockImplementation(() => respondWith(pair("new")));

    await refreshTokens("token-1");
    vi.advanceTimersByTime(61_000);

    // Well past any in-flight request, this really is a replayed token and
    // deserves the backend's answer, whatever that is.
    await refreshTokens("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not share a result between different tokens", async () => {
    const { refreshTokens } = await loadModule();
    fetchMock
      .mockImplementationOnce(() => respondWith(pair("a")))
      .mockImplementationOnce(() => respondWith(pair("b")));

    // Two different families. Sharing a result here would hand one session's
    // tokens to another.
    expect(await refreshTokens("token-a")).toEqual(pair("a"));
    expect(await refreshTokens("token-b")).toEqual(pair("b"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null without caching when the token is rejected", async () => {
    const { refreshTokens } = await loadModule();
    fetchMock.mockImplementation(
      () => Promise.resolve(new Response("{}", { status: 401 })),
    );

    expect(await refreshTokens("token-1")).toBeNull();

    // A failure must not be remembered: the next caller gets a real attempt
    // rather than a cached "no", which would outlive the cause.
    expect(await refreshTokens("token-1")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when the API is unreachable", async () => {
    const { refreshTokens } = await loadModule();
    fetchMock.mockImplementation(() => Promise.reject(new Error("ECONNREFUSED")));

    await expect(refreshTokens("token-1")).resolves.toBeNull();
  });
});
