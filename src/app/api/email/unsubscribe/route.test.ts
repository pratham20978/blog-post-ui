import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

describe("one-click unsubscribe BFF", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps GET non-destructive and redirects to the confirmation page", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/email/unsubscribe?token=signed-token"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/email/unsubscribe?token=signed-token",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards RFC 8058 POST and returns an empty accepted response", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/email/unsubscribe?token=signed-token", {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/api/v1/email/preferences/unsubscribe",
        search: "?token=signed-token",
      }),
      { method: "POST", cache: "no-store" },
    );
  });

  it("rejects POST without a token before reaching the API", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/email/unsubscribe", { method: "POST" }),
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
