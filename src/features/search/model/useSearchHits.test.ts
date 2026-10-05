import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BlogSummary } from "@/shared/contracts";

import type { SearchPort } from "./port";
import { useSearchHits } from "./useSearchHits";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock("@/app/providers/EngagementProvider", () => ({
  useBeacon: () => ({ record: mocks.record }),
}));

/** An adapter that answers every query with the given ids. */
function adapterFor(...ids: string[]): SearchPort & { search: ReturnType<typeof vi.fn> } {
  return {
    search: vi.fn(async () => ({
      hits: ids.map((id) => ({ blog: { id } as BlogSummary, score: 1, matchedOn: [] })),
      queryId: `query-${ids.join("-")}`,
    })),
  };
}

const idsOf = (hits: readonly { blog: BlogSummary }[]) => hits.map((hit) => hit.blog.id);

describe("useSearchHits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.record.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("is settled and empty with nothing typed", () => {
    const adapter = adapterFor("a");
    const { result } = renderHook(() => useSearchHits(adapter, "   "));

    expect(result.current).toEqual({ hits: [], settled: true });
    expect(adapter.search).not.toHaveBeenCalled();
  });

  it("searches once after the debounce, then settles and records one impression", async () => {
    const adapter = adapterFor("a");
    const { result, rerender } = renderHook(({ query }) => useSearchHits(adapter, query), {
      initialProps: { query: "c" },
    });

    rerender({ query: "cu" });
    rerender({ query: "cud" });
    expect(result.current.settled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(149);
    });
    expect(adapter.search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(adapter.search).toHaveBeenCalledTimes(1);
    expect(adapter.search).toHaveBeenCalledWith("cud", expect.any(AbortSignal));
    expect(result.current.settled).toBe(true);
    expect(idsOf(result.current.hits)).toEqual(["a"]);
    expect(mocks.record).toHaveBeenCalledWith({
      kind: "search_impression",
      query_id: "query-a",
      source: "search",
    });
  });

  it("keeps the last results on screen, unsettled, while a new adapter searches", async () => {
    const before = adapterFor("old");
    const after = adapterFor("new");
    const { result, rerender } = renderHook(({ adapter }) => useSearchHits(adapter, "query"), {
      initialProps: { adapter: before as SearchPort },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(idsOf(result.current.hits)).toEqual(["old"]);

    // The corpus finished loading, say, and the adapter was rebuilt over it.
    rerender({ adapter: after });
    expect(result.current).toMatchObject({ settled: false });
    expect(idsOf(result.current.hits)).toEqual(["old"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(result.current.settled).toBe(true);
    expect(idsOf(result.current.hits)).toEqual(["new"]);
  });
});
