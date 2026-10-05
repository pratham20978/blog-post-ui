import { queryOptions } from "@tanstack/react-query";

import { clientFetch } from "@/shared/api/client";
import { localRoutes } from "@/shared/api/routes";
import type { BlogSummary, KeyStr } from "@/shared/contracts";

/**
 * Browser-side reads for article data, as React Query options.
 *
 * Options rather than hooks, so a component composes them with `useQuery`
 * itself and a test or a prefetch can reuse the same key and fetcher.
 */

/** The whole published archive, optionally in one category. */
export function blogIndexQuery(category?: KeyStr) {
  return queryOptions({
    queryKey: ["blogs", "index", category ?? "all"],
    queryFn: ({ signal }) =>
      clientFetch<readonly BlogSummary[]>(localRoutes.blogIndex(category), { signal }),
    // The route reads through a 60s server cache; holding it longer here
    // would only show a stale archive.
    staleTime: 60_000,
  });
}
