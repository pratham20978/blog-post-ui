import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  fetchCategories,
  fetchCovers,
  fetchFeed,
  fetchSeries,
} from "@/entities/blog/api/server";
import { seriesBlogs } from "@/entities/blog/model/selectors";
import { BlogCover } from "@/entities/blog/ui/BlogCover";
import { formatDateCompact, formatReadingTime } from "@/shared/lib/date";
import { Container, Eyebrow, MetaRow } from "@/shared/ui/primitives";

type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { key } = await params;
  const series = (await fetchSeries()).find((entry) => entry.key === key);

  if (!series) return { title: "Not found" };

  return {
    title: series.title,
    description: series.description ?? undefined,
    alternates: { canonical: `/series/${series.key}` },
  };
}

export default async function SeriesDetailPage({ params }: { params: Params }) {
  const { key } = await params;

  // Series are addressed by key in the URL but the feed filters by id, so the
  // list is the lookup table — there is no get-series-by-key endpoint.
  const series = (await fetchSeries()).find((entry) => entry.key === key);
  if (!series) notFound();

  const [feed, categories] = await Promise.all([
    fetchFeed({ series_id: series.id, limit: 100 }),
    fetchCategories(),
  ]);

  const ordered = seriesBlogs(feed.items, series.id);
  const covers = await fetchCovers(ordered);
  const categoryLabels = new Map(categories.map((entry) => [entry.key, entry.label]));

  return (
    <Container className="pb-20 pt-10 sm:pt-14">
      <header className="max-w-2xl">
        <Eyebrow>Series</Eyebrow>
        <h1 className="mt-3 text-display font-semibold leading-display tracking-display">
          {series.title}
        </h1>
        {series.description && (
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">
            {series.description}
          </p>
        )}
        <p className="mt-4 text-meta text-muted">
          {ordered.length === 0
            ? "No articles published yet."
            : `${ordered.length} ${ordered.length === 1 ? "article" : "articles"}`}
        </p>
      </header>

      {ordered.length === 0 ? (
        <div className="mt-12 border border-rule bg-surface px-6 py-10 text-center">
          <p className="text-[0.9375rem] text-muted">
            This series has been announced but nothing is published yet.
          </p>
          <Link
            href="/blogs"
            className="mt-4 inline-block text-[0.9375rem] underline underline-offset-4"
          >
            Browse all articles
          </Link>
        </div>
      ) : (
        // A numbered reading path rather than a grid — the order is the point
        // of a series, and a grid does not convey one.
        <ol className="mt-14 border-t border-rule">
          {ordered.map((blog, index) => (
            <li key={blog.id} className="border-b border-rule">
              <Link
                href={`/blogs/${blog.slug}`}
                className="group grid grid-cols-[auto_1fr] gap-x-5 gap-y-4 py-8 sm:grid-cols-[auto_1fr_auto] sm:gap-x-8"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-meta text-muted tabular-nums"
                >
                  {String(blog.series_position ?? index + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                  <h2 className="text-subheading font-semibold tracking-title transition-colors group-hover:text-muted">
                    {blog.title}
                  </h2>
                  {blog.summary && (
                    <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted">
                      {blog.summary}
                    </p>
                  )}
                  <MetaRow
                    className="mt-3"
                    items={[
                      formatDateCompact(blog.published_at),
                      formatReadingTime(blog.reading_minutes),
                      blog.category_keys
                        .map((k) => categoryLabels.get(k))
                        .filter(Boolean)
                        .join(" · "),
                    ]}
                  />
                </div>

                <BlogCover
                  blog={blog}
                  cover={covers.get(blog.slug)}
                  sizes="200px"
                  className="col-span-2 aspect-[16/9] w-full sm:col-span-1 sm:w-[200px]"
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Container>
  );
}
