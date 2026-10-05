import type { NextRequest } from "next/server";

import { fetchAllPublishedBlogs } from "@/entities/blog/api/server";
import { fail, ok } from "@/shared/api/responses";

/**
 * `GET /api/blogs[?category=key]` → every published article, newest first.
 *
 * The index behind the "browse all articles" dialog, which lists and searches
 * the whole archive rather than the window the feed page fetched. Served from
 * here rather than paged through the BFF so the browser makes one request
 * however large the archive grows, and so it reads through the same server
 * data layer as every page: fixtures or API, and the Next data cache, which
 * means the backend sees at most one walk of the archive a minute however many
 * readers open the dialog.
 */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") ?? undefined;

  try {
    return ok(await fetchAllPublishedBlogs({ category }));
  } catch {
    return fail(502, "INTERNAL_ERROR", "The article index could not be loaded.", {
      stage: "ACCESS",
      retryability: "RETRYABLE",
    });
  }
}
