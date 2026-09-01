import type { Metadata } from "next";
import Link from "next/link";

import { fetchFeed, fetchSeries } from "@/entities/blog/api/server";
import { seriesBlogCounts } from "@/entities/blog/model/selectors";
import { Container, Eyebrow } from "@/shared/ui/primitives";

export const metadata: Metadata = {
  title: "Series",
  description: "Multi-part reading paths.",
};

export default async function SeriesIndexPage() {
  const [series, feed] = await Promise.all([fetchSeries(), fetchFeed({ limit: 100 })]);
  const counts = seriesBlogCounts(feed.items);

  return (
    <Container className="pb-20 pt-10 sm:pt-14">
      <header className="max-w-2xl">
        <Eyebrow>Reading paths</Eyebrow>
        <h1 className="mt-3 text-display font-semibold leading-display tracking-display">
          Series
        </h1>
        <p className="mt-4 text-[1.0625rem] text-muted">
          Articles written to be read in order.
        </p>
      </header>

      {series.length === 0 ? (
        <p className="mt-12 text-[0.9375rem] text-muted">No series yet.</p>
      ) : (
        <ul className="mt-12 border-t border-rule">
          {series.map((entry) => {
            const count = counts.get(entry.id) ?? 0;

            return (
              <li key={entry.id} className="border-b border-rule">
                <Link
                  href={`/series/${entry.key}`}
                  className="group flex flex-col gap-2 py-8 sm:flex-row sm:items-baseline sm:gap-8"
                >
                  <div className="flex-1">
                    <h2 className="text-title font-semibold tracking-title transition-colors group-hover:text-muted">
                      {entry.title}
                    </h2>
                    {entry.description && (
                      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted">
                        {entry.description}
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 text-meta text-muted">
                    {/* A series with nothing published is announced, not empty
                        — the distinction is the whole "upcoming" concept. */}
                    {count === 0
                      ? "Coming soon"
                      : `${count} ${count === 1 ? "article" : "articles"}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
