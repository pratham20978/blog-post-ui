import "server-only";

import { routes } from "@/shared/api/routes";
import { serverFetch, serverFetchOptional } from "@/shared/api/server";
import { dataSource } from "@/shared/config";
import type {
  BlogContent,
  BlogDetail,
  BlogListParams,
  BlogSummary,
  Category,
  Page,
  Series,
} from "@/shared/contracts";
import { extractCover, type DerivedCover } from "@/shared/lib/cover";

import { blogContents, blogSummaries, detailFor } from "@/shared/fixtures/blogs";
import { categories as fixtureCategories, series as fixtureSeries } from "@/shared/fixtures/taxonomy";

/**
 * Server-side reads for article data.
 *
 * Every page goes through here rather than calling `serverFetch` directly, so
 * the fixtures/API switch lives in one file and no screen knows which is in
 * play. Components receive the same shapes either way.
 */

const usingFixtures = () => dataSource() === "fixtures";

export async function fetchFeed(params: BlogListParams = {}): Promise<Page<BlogSummary>> {
  if (usingFixtures()) {
    const filtered = blogSummaries.filter((blog) => {
      if (params.category && !blog.category_keys.includes(params.category)) return false;
      if (params.series_id && blog.series_id !== params.series_id) return false;
      return true;
    });
    return { items: filtered, next_cursor: null, has_more: false };
  }

  return serverFetch<Page<BlogSummary>>(routes.blogs(), {
    query: {
      category: params.category,
      series_id: params.series_id,
      cursor: params.cursor,
      limit: params.limit,
    },
    // Published articles are the same for every caller, so this is cacheable
    // and must not carry a token — `anonymous` keeps it out of a per-user
    // cache entry.
    anonymous: true,
    revalidate: 60,
    tags: ["blogs"],
  });
}

/**
 * The feed, degrading to empty instead of throwing.
 *
 * For callers where the feed is an enhancement rather than the point — the
 * layout's search corpus, the profile page's id lookup. A layout that throws
 * takes down every route beneath it, including the error screen that would
 * have explained what went wrong, so the shell must always be able to render.
 *
 * Pages whose whole purpose is the feed use `fetchFeed` and let it throw, so
 * the error boundary can show a real failure rather than an empty state that
 * misreports an outage as "no articles yet".
 */
export async function fetchFeedSafe(params: BlogListParams = {}): Promise<Page<BlogSummary>> {
  try {
    return await fetchFeed(params);
  } catch {
    return { items: [], next_cursor: null, has_more: false };
  }
}

/** Null rather than a throw, so a page can render its own not-found screen. */
export async function fetchBlog(slug: string): Promise<BlogDetail | null> {
  if (usingFixtures()) {
    const summary = blogSummaries.find((blog) => blog.slug === slug);
    return summary ? detailFor(summary) : null;
  }

  return serverFetchOptional<BlogDetail>(routes.blog(slug), {
    anonymous: true,
    revalidate: 60,
    tags: ["blogs", `blog:${slug}`],
  });
}

export async function fetchContent(slug: string): Promise<BlogContent | null> {
  if (usingFixtures()) {
    return blogContents[slug] ?? null;
  }

  return serverFetchOptional<BlogContent>(routes.blogContent(slug), {
    anonymous: true,
    revalidate: 60,
    tags: [`blog:${slug}`],
  });
}

export async function fetchCategories(): Promise<readonly Category[]> {
  if (usingFixtures()) return fixtureCategories;

  return (
    (await serverFetchOptional<readonly Category[]>(routes.categories(), {
      anonymous: true,
      revalidate: 300,
      tags: ["taxonomy"],
    })) ?? []
  );
}

export async function fetchSeries(): Promise<readonly Series[]> {
  if (usingFixtures()) return fixtureSeries;

  return (
    (await serverFetchOptional<readonly Series[]>(routes.series(), {
      anonymous: true,
      revalidate: 300,
      tags: ["taxonomy"],
    })) ?? []
  );
}

/**
 * Resolve cover images for a set of cards.
 *
 * The feed carries no body, and there is no media field on the API, so the
 * only place a cover can come from is the first image in the Markdown — which
 * means one content fetch per card. Three things keep that affordable:
 *
 *   the requests run in parallel, not in series;
 *   each is tagged and revalidated, so Next's data cache serves repeats;
 *   the backend already sets a strong ETag and `max-age=60` on this route.
 *
 * A failure yields null rather than propagating: a missing cover falls back to
 * the typographic one, and no card should be able to take down the feed.
 */
export async function fetchCovers(
  blogs: readonly BlogSummary[],
): Promise<ReadonlyMap<string, DerivedCover | null>> {
  const entries = await Promise.all(
    blogs.map(async (blog): Promise<[string, DerivedCover | null]> => {
      try {
        const content = await fetchContent(blog.slug);
        return [blog.slug, content ? extractCover(content.markdown, blog.title) : null];
      } catch {
        return [blog.slug, null];
      }
    }),
  );

  return new Map(entries);
}
