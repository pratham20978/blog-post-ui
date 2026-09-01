import type { Metadata } from "next";
import { Suspense } from "react";

import { fetchCategories, fetchFeed, fetchSeries } from "@/entities/blog/api/server";
import { SearchResults } from "@/features/search/ui/SearchResults";
import { Container, Eyebrow, Skeleton } from "@/shared/ui/primitives";

export const metadata: Metadata = {
  title: "Search",
  // A search results page is not something to index.
  robots: { index: false, follow: true },
};

export default async function SearchPage() {
  const [feed, categories, series] = await Promise.all([
    fetchFeed({ limit: 100 }),
    fetchCategories(),
    fetchSeries(),
  ]);

  return (
    <Container className="pb-20 pt-10 sm:pt-14">
      <header className="max-w-2xl">
        <Eyebrow>Search</Eyebrow>
        <h1 className="mt-3 text-title font-semibold tracking-title">Find an article</h1>
      </header>

      <div className="mt-10 max-w-4xl">
        {/*
          `useSearchParams` opts the subtree into client rendering, so it needs
          a Suspense boundary or the whole route is forced dynamic.
        */}
        <Suspense fallback={<Skeleton className="h-14 w-full" />}>
          <SearchResults corpus={{ blogs: feed.items, categories, series }} />
        </Suspense>
      </div>
    </Container>
  );
}
