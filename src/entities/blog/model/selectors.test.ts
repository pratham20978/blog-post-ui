import { describe, expect, it } from "vitest";

import type { BlogSummary, Series } from "@/shared/contracts";

import {
  byNewest,
  deriveFeedSections,
  nextBlog,
  seriesBlogCounts,
  seriesBlogs,
} from "./selectors";

function blog(overrides: Partial<BlogSummary> & Pick<BlogSummary, "id" | "slug">): BlogSummary {
  return {
    title: overrides.slug,
    summary: null,
    status: "published",
    series_id: null,
    series_position: null,
    category_keys: [],
    word_count: 500,
    reading_minutes: 3,
    published_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function series(id: string, key: string): Series {
  return { id, key, title: key, description: null };
}

describe("byNewest", () => {
  it("orders by published_at descending", () => {
    const ordered = byNewest([
      blog({ id: "a", slug: "a", published_at: "2026-01-01T00:00:00Z" }),
      blog({ id: "c", slug: "c", published_at: "2026-03-01T00:00:00Z" }),
      blog({ id: "b", slug: "b", published_at: "2026-02-01T00:00:00Z" }),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });

  it("breaks ties on id so the order is stable across renders", () => {
    const same = "2026-01-01T00:00:00Z";
    const ordered = byNewest([
      blog({ id: "aaa", slug: "a", published_at: same }),
      blog({ id: "ccc", slug: "c", published_at: same }),
      blog({ id: "bbb", slug: "b", published_at: same }),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["ccc", "bbb", "aaa"]);
  });

  it("sorts unpublished entries last rather than dropping them", () => {
    const ordered = byNewest([
      blog({ id: "draft", slug: "draft", published_at: null }),
      blog({ id: "live", slug: "live", published_at: "2026-01-01T00:00:00Z" }),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["live", "draft"]);
  });

  it("does not mutate its input", () => {
    const input = [
      blog({ id: "a", slug: "a", published_at: "2026-01-01T00:00:00Z" }),
      blog({ id: "b", slug: "b", published_at: "2026-02-01T00:00:00Z" }),
    ];
    byNewest(input);

    expect(input.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("deriveFeedSections", () => {
  const foundations = series("s1", "foundations");
  const planned = series("s2", "planned");

  const blogs = [
    blog({ id: "b5", slug: "newest", published_at: "2026-05-01T00:00:00Z" }),
    blog({
      id: "b4",
      slug: "part-two",
      published_at: "2026-04-01T00:00:00Z",
      series_id: "s1",
      series_position: 2,
    }),
    blog({ id: "b3", slug: "third", published_at: "2026-03-01T00:00:00Z" }),
    blog({
      id: "b2",
      slug: "part-one",
      published_at: "2026-02-01T00:00:00Z",
      series_id: "s1",
      series_position: 1,
    }),
    blog({ id: "b1", slug: "oldest", published_at: "2026-01-01T00:00:00Z" }),
  ];

  it("features the most recently published article", () => {
    expect(deriveFeedSections(blogs, []).featured?.id).toBe("b5");
  });

  it("takes trending as the next three, excluding the featured one", () => {
    const { trending } = deriveFeedSections(blogs, []);

    expect(trending.map((entry) => entry.id)).toEqual(["b4", "b3", "b2"]);
    expect(trending.some((entry) => entry.id === "b5")).toBe(false);
  });

  it("picks the current series from the newest article that has one", () => {
    // The featured article (b5) has no series, so the anchor falls through to
    // b4 — the newest that does.
    const { currentSeries } = deriveFeedSections(blogs, [foundations, planned]);

    expect(currentSeries?.series.id).toBe("s1");
  });

  it("orders current-series blogs by series_position, not by date", () => {
    const { currentSeries } = deriveFeedSections(blogs, [foundations]);

    expect(currentSeries?.blogs.map((entry) => entry.id)).toEqual(["b2", "b4"]);
  });

  it("treats a series with no published article as upcoming", () => {
    const { upcomingSeries } = deriveFeedSections(blogs, [foundations, planned]);

    expect(upcomingSeries.map((entry) => entry.id)).toEqual(["s2"]);
  });

  it("ignores a series_id that no known series matches", () => {
    const orphan = [blog({ id: "x", slug: "x", series_id: "gone", series_position: 1 })];
    const { currentSeries } = deriveFeedSections(orphan, [foundations]);

    expect(currentSeries).toBeNull();
  });

  it("returns empty rails rather than throwing when nothing is published", () => {
    const sections = deriveFeedSections([], [foundations]);

    expect(sections.featured).toBeNull();
    expect(sections.trending).toEqual([]);
    expect(sections.currentSeries).toBeNull();
    // A series with nothing published is upcoming, which is the correct
    // reading of a brand-new site.
    expect(sections.upcomingSeries).toEqual([foundations]);
  });

  it("yields no trending rail when only one article exists", () => {
    const single = [blog({ id: "only", slug: "only" })];
    const sections = deriveFeedSections(single, []);

    expect(sections.featured?.id).toBe("only");
    expect(sections.trending).toEqual([]);
  });
});

describe("seriesBlogs", () => {
  it("filters to the series and orders by position", () => {
    const blogs = [
      blog({ id: "c", slug: "c", series_id: "s1", series_position: 3 }),
      blog({ id: "a", slug: "a", series_id: "s1", series_position: 1 }),
      blog({ id: "other", slug: "other", series_id: "s2", series_position: 1 }),
      blog({ id: "b", slug: "b", series_id: "s1", series_position: 2 }),
    ];

    expect(seriesBlogs(blogs, "s1").map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

describe("seriesBlogCounts", () => {
  it("counts only blogs that belong to a series", () => {
    const counts = seriesBlogCounts([
      blog({ id: "a", slug: "a", series_id: "s1" }),
      blog({ id: "b", slug: "b", series_id: "s1" }),
      blog({ id: "c", slug: "c", series_id: "s2" }),
      blog({ id: "d", slug: "d" }),
    ]);

    expect(counts.get("s1")).toBe(2);
    expect(counts.get("s2")).toBe(1);
    expect(counts.size).toBe(2);
  });
});

/**
 * `nextBlog` picks at random, so there is no single expected answer to assert.
 * What can be asserted are the invariants that must hold for *every* draw —
 * and those are the ones that matter, because each corresponds to a visible
 * bug: an article linking to itself, a link to something that is not in the
 * feed, or a dead end at the last article.
 *
 * The picks are exercised many times rather than once. A single call passes
 * against a broken implementation most of the time, which is worse than no
 * test at all.
 */
describe("nextBlog", () => {
  const parts = [
    blog({ id: "a", slug: "a", series_id: "s1", series_position: 1, published_at: "2026-01-03T00:00:00Z" }),
    blog({ id: "b", slug: "b", series_id: "s1", series_position: 2, published_at: "2026-01-02T00:00:00Z" }),
    blog({ id: "c", slug: "c", series_id: "s1", series_position: 3, published_at: "2026-01-01T00:00:00Z" }),
  ];

  const draws = (feed = parts, current: { id: string; series_id: string | null } = { id: "b", series_id: "s1" }) =>
    Array.from({ length: 200 }, () => nextBlog(feed, current));

  it("never suggests the article being read", () => {
    for (const result of draws()) expect(result?.blog.id).not.toBe("b");
  });

  it("only ever suggests something from the feed it was given", () => {
    const ids = new Set(parts.map((entry) => entry.id));
    for (const result of draws()) expect(ids.has(result?.blog.id ?? "")).toBe(true);
  });

  it("reaches every other article, given enough draws", () => {
    // Guards against an off-by-one that quietly makes one article
    // unreachable — the kind of bug a single-draw test never catches.
    const seen = new Set(draws().map((result) => result?.blog.id));
    expect(seen).toEqual(new Set(["a", "c"]));
  });

  it("suggests something even for an article outside the given feed", () => {
    // The article page fetches a bounded window, so the current article can
    // legitimately fall outside it. Answering null there would dead-end a
    // perfectly good page.
    const result = nextBlog(parts, { id: "not-in-feed", series_id: null });
    expect(result).not.toBeNull();
  });

  it("returns null when the article is the only one published", () => {
    const only = blog({ id: "solo", slug: "solo" });

    expect(nextBlog([only], { id: "solo", series_id: null })).toBeNull();
  });

  it("returns null for an empty feed", () => {
    expect(nextBlog([], { id: "anything", series_id: null })).toBeNull();
  });
});
