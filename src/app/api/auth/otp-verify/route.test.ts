import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverFetch: vi.fn(),
}));

vi.mock("@/features/auth/server/demo-session", () => ({
  demoAuthEnabled: () => false,
  demoCookie: vi.fn(),
  demoUserFor: vi.fn(),
}));

vi.mock("@/shared/api/server", () => ({
  serverFetch: mocks.serverFetch,
}));

import { POST } from "./route";

const tokens = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  actor_token: "actor-token",
  token_type: "Bearer" as const,
  expires_in: 900,
};

function request(body: object) {
  return new Request("http://localhost/api/auth/otp-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("OTP verification BFF", () => {
  beforeEach(() => {
    mocks.serverFetch.mockReset().mockResolvedValue(tokens);
  });

  it("forwards signup purpose and converts tokens into HTTP-only cookies", async () => {
    const response = await POST(
      request({ email: "reader@example.com", code: "123456", purpose: "signup" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.serverFetch).toHaveBeenCalledWith("/auth/otp/verify", {
      method: "POST",
      body: { email: "reader@example.com", code: "123456", purpose: "signup" },
    });
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("blogs_at=access-token");
    expect(cookies).toContain("blogs_rt=refresh-token");
    expect(cookies).toContain("HttpOnly");
    expect(await response.json()).not.toHaveProperty("access_token");
  });

  it("defaults an omitted purpose to login for an older client", async () => {
    await POST(request({ email: "reader@example.com", code: "123456" }));

    expect(mocks.serverFetch).toHaveBeenCalledWith("/auth/otp/verify", {
      method: "POST",
      body: { email: "reader@example.com", code: "123456", purpose: "login" },
    });
  });

  it("rejects an unknown purpose before calling the API", async () => {
    const response = await POST(
      request({ email: "reader@example.com", code: "123456", purpose: "reset" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.serverFetch).not.toHaveBeenCalled();
  });
});
