import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverFetch: vi.fn(),
  serverFetchOptional: vi.fn(),
}));

vi.mock("@/shared/config", () => ({ dataSource: () => "api" }));
vi.mock("@/shared/api/server", () => mocks);

import { fetchAllPublishedBlogs, fetchFeed } from "./server";

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

  it("follows every cursor for a complete sitemap inventory", async () => {
    mocks.serverFetch
      .mockResolvedValueOnce({ items: [{ id: "one" }], next_cursor: "next", has_more: true })
      .mockResolvedValueOnce({ items: [{ id: "two" }], next_cursor: null, has_more: false });

    const result = await fetchAllPublishedBlogs();

    expect(result.map((item) => item.id)).toEqual(["one", "two"]);
    expect(mocks.serverFetch.mock.calls[1]?.[1]?.query?.cursor).toBe("next");
  });
});
