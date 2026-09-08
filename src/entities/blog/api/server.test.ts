import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverFetch: vi.fn(),
  serverFetchOptional: vi.fn(),
}));

vi.mock("@/shared/config", () => ({ dataSource: () => "api" }));
vi.mock("@/shared/api/server", () => mocks);

import { fetchFeed } from "./server";

describe("fetchFeed", () => {
  beforeEach(() => {
    mocks.serverFetch.mockReset();
    mocks.serverFetchOptional.mockReset();
  });

  it("uses summary cover metadata without per-article content requests", async () => {
    mocks.serverFetch.mockResolvedValue({ items: [], next_cursor: null, has_more: false });

    await fetchFeed({ limit: 50 });

    expect(mocks.serverFetch).toHaveBeenCalledTimes(1);
    expect(mocks.serverFetch.mock.calls[0]?.[0]).toBe("/blogs");
    expect(
      [...mocks.serverFetch.mock.calls, ...mocks.serverFetchOptional.mock.calls].some(
        ([path]) => String(path).endsWith("/content"),
      ),
    ).toBe(false);
  });
});
