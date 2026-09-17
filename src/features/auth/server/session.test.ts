import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  serverFetchOptional: vi.fn(),
  readDemoSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock("@/shared/api/server", () => ({
  serverFetchOptional: mocks.serverFetchOptional,
}));

vi.mock("./demo-session", () => ({
  readDemoSession: mocks.readDemoSession,
}));

import { getServerSession } from "./session";

describe("getServerSession", () => {
  beforeEach(() => {
    mocks.cookies.clear();
    mocks.serverFetchOptional.mockReset();
    mocks.readDemoSession.mockReset().mockResolvedValue(null);
  });

  it("does not mint an orphan actor during a cookie-less server render", async () => {
    await expect(getServerSession()).resolves.toEqual({
      status: "anonymous",
      actorId: null,
    });
    expect(mocks.serverFetchOptional).not.toHaveBeenCalled();
  });

  it("does not validate an actor cookie where a replacement cannot be stored", async () => {
    mocks.cookies.set("blogs_act", "actor-token");

    await expect(getServerSession()).resolves.toEqual({
      status: "anonymous",
      actorId: null,
    });
    expect(mocks.serverFetchOptional).not.toHaveBeenCalled();
  });

  it("resolves an authenticated access token", async () => {
    mocks.cookies.set("blogs_at", "access-token");
    mocks.serverFetchOptional.mockResolvedValue({
      id: "00000000-0000-7000-8000-000000000002",
      email: "reader@example.com",
    });

    await getServerSession();
    expect(mocks.serverFetchOptional).toHaveBeenCalledTimes(1);
  });

  it("leaves refresh-only sessions for the cookie-writing BFF", async () => {
    mocks.cookies.set("blogs_rt", "refresh-token");

    await expect(getServerSession()).resolves.toEqual({ status: "loading" });
    expect(mocks.serverFetchOptional).not.toHaveBeenCalled();
  });
});
