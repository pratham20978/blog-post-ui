import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RefreshResult } from "@/features/auth/server/refresh";

/**
 * The proxy's refresh decision, tested on the shape that used to slip past it.
 *
 * The access cookie and the JWT inside it expire together, so a browser that
 * has been away fifteen minutes sends a refresh cookie and nothing else. The
 * backend answers that with a 200 "anonymous" — not a 401 — and a proxy that
 * only refreshes on 401 never notices. The assertion that matters is therefore
 * about the request that goes *out*: it must already carry a fresh bearer.
 */

const mocks = vi.hoisted(() => ({
  refreshTokens: vi.fn<(token: string) => Promise<RefreshResult>>(),
}));

vi.mock("@/features/auth/server/refresh", () => ({
  refreshTokens: mocks.refreshTokens,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { NextRequest } from "next/server";

import { GET } from "./route";

const rotated: RefreshResult = {
  status: "rotated",
  pair: {
    access_token: "access-new",
    refresh_token: "refresh-new",
    actor_token: "actor-new",
    token_type: "Bearer",
    expires_in: 900,
  },
};

function apiResponse(status: number, data: unknown, category?: string): Response {
  return new Response(
    JSON.stringify({
      success: status < 400,
      message: "",
      data: status < 400 ? data : null,
      error: category ? { category, safe_message: "" } : null,
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

const anonymous = { kind: "anonymous", actor_id: "actor-1" };
const user = { id: "user-1", email: "reader@example.com" };

function call(cookies: Record<string, string>) {
  const request = new NextRequest("http://localhost/api/bff/auth/me", {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
  });
  return GET(request, { params: Promise.resolve({ path: ["auth", "me"] }) });
}

function bearerOf(callIndex = 0): string | null {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  return new Headers(init?.headers).get("authorization");
}

describe("BFF proxy session restoration", () => {
  beforeEach(() => {
    mocks.refreshTokens.mockReset();
    fetchMock.mockReset();
  });

  it("refreshes before forwarding when only the refresh cookie remains", async () => {
    mocks.refreshTokens.mockResolvedValue(rotated);
    fetchMock.mockResolvedValue(apiResponse(200, user));

    const response = await call({ blogs_rt: "refresh-old", blogs_act: "actor-old" });

    expect(mocks.refreshTokens).toHaveBeenCalledTimes(1);
    expect(mocks.refreshTokens).toHaveBeenCalledWith("refresh-old");
    // One outbound request, already authenticated — never a bare one first.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bearerOf()).toBe("Bearer access-new");

    expect(response.status).toBe(200);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("blogs_at=access-new");
    expect(cookies).toContain("blogs_rt=refresh-new");
  });

  it("clears the pair and forwards anonymously when the refresh token is rejected", async () => {
    mocks.refreshTokens.mockResolvedValue({ status: "rejected" });
    fetchMock.mockResolvedValue(apiResponse(200, anonymous));

    const response = await call({ blogs_rt: "refresh-spent", blogs_act: "actor-old" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bearerOf()).toBeNull();

    expect(response.status).toBe(200);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toMatch(/blogs_at=;[^,]*Max-Age=0/);
    expect(cookies).toMatch(/blogs_rt=;[^,]*Max-Age=0/);
  });

  it("holds restoration neutral when the API cannot be reached for the refresh", async () => {
    mocks.refreshTokens.mockResolvedValue({ status: "unavailable" });

    const response = await call({ blogs_rt: "refresh-old" });

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("still refreshes and replays when an expired access token was sent", async () => {
    mocks.refreshTokens.mockResolvedValue(rotated);
    fetchMock
      .mockResolvedValueOnce(apiResponse(401, null, "AUTH_TOKEN_EXPIRED"))
      .mockResolvedValueOnce(apiResponse(200, user));

    const response = await call({ blogs_at: "access-expired", blogs_rt: "refresh-old" });

    expect(mocks.refreshTokens).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bearerOf(0)).toBe("Bearer access-expired");
    expect(bearerOf(1)).toBe("Bearer access-new");
    expect(response.status).toBe(200);
  });

  it("passes a signed-out visitor through without touching the refresh path", async () => {
    fetchMock.mockResolvedValue(apiResponse(200, anonymous));

    await call({ blogs_act: "actor-old" });

    expect(mocks.refreshTokens).not.toHaveBeenCalled();
    expect(bearerOf()).toBeNull();
  });
});
