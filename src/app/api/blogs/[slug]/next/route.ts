import { fetchBlog, fetchFeed } from "@/entities/blog/api/server";
import { nextBlog, type NextReason } from "@/entities/blog/model/selectors";
import { fail, ok } from "@/shared/api/responses";

/**
 * `GET /api/blogs/{slug}/next` → what to read after this article.
 *
 * ```json
 * { "success": true, "data": { "slug": "…", "id": "…", "title": "…", "reason": "random" } }
 * ```
 *
 * The article page does **not** call this — it is a Server Component and reads
 * `nextBlog()` directly, because an extra HTTP hop to our own origin would be
 * pure latency for an answer already in memory. The route exists so the choice
 * is addressable from outside a render: a client widget, a prefetch, an email
 * digest, or anything else that wants the answer without reproducing the rule.
 *
 * Both paths go through the same selector, so they cannot drift. When
 * relevance ranking replaces the random pick it changes there, and this route
 * needs no edit.
 */

interface NextBlogResponse {
  readonly slug: string;
  readonly id: string;
  readonly title: string;
  /** Which rule picked it. `random` today — the field exists so a caller can
   *  tell a real recommendation from a placeholder once there is one. */
  readonly reason: NextReason;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const blog = await fetchBlog(slug);
  if (!blog) {
    return fail(404, "BLOG_NOT_FOUND", "No published article has that slug.", {
      stage: "ACCESS",
    });
  }

  // The whole published set, because the answer may sit outside this
  // article's series — and does whenever it has none. `limit` matches the
  // backend's ceiling.
  const feed = await fetchFeed({ limit: 100 });
  const next = nextBlog(feed.items, blog);

  if (!next) {
    return fail(404, "BLOG_NOT_FOUND", "There is nothing else published to read.", {
      stage: "ACCESS",
    });
  }

  return ok<NextBlogResponse>(
    {
      slug: next.blog.slug,
      id: next.blog.id,
      title: next.blog.title,
      reason: next.reason,
    },
    // Uncached, because the answer is drawn fresh on every call. Caching a
    // random pick would make it a fixed one with extra steps.
    { headers: { "cache-control": "no-store" } },
  );
}
