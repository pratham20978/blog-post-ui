import type { Metadata } from "next";
import Link from "next/link";

import {
  fetchCategories,
  fetchCovers,
  fetchFeed,
  fetchSeries,
} from "@/entities/blog/api/server";
import { deriveFeedSections } from "@/entities/blog/model/selectors";
import { BlogCard } from "@/entities/blog/ui/BlogCard";
import { readServerConfig } from "@/shared/config";
import { ChipLink, Container, Eyebrow, Rule, SectionHeading } from "@/shared/ui/primitives";

export const metadata: Metadata = {
  title: "Articles",
  description: "Essays and series on building software.",
};

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const config = readServerConfig();

  const [feed, categories, series] = await Promise.all([
    fetchFeed({ limit: 50, ...(category && { category }) }),
    fetchCategories(),
    fetchSeries(),
  ]);

  const sections = deriveFeedSections(feed.items, series);
  const covers = await fetchCovers(sections.all);

  const categoryLabels = new Map(categories.map((entry) => [entry.key, entry.label]));
  const seriesTitles = new Map(series.map((entry) => [entry.id, entry.title]));

  const titleFor = (seriesId: string | null) =>
    seriesId ? seriesTitles.get(seriesId) : undefined;

  if (sections.all.length === 0) {
    return (
      <Container className="py-24 text-center">
        <Eyebrow>Nothing here yet</Eyebrow>
        <h1 className="mt-4 text-title font-semibold tracking-title">
          {category ? "No articles in this category" : "No articles published yet"}
        </h1>
        {category && (
          <Link href="/blogs" className="mt-6 inline-block text-[0.9375rem] underline underline-offset-4">
            Browse all articles
          </Link>
        )}
      </Container>
    );
  }

  return (
    <Container width="wide" className="pb-20 pt-10 sm:pt-14">
      {/* Filters. Links rather than buttons, so a filtered feed is shareable
          and survives a reload. */}
      <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
        <ChipLink href="/blogs" active={!category}>
          All
        </ChipLink>
        {categories.map((entry) => (
          <ChipLink
            key={entry.key}
            href={`/blogs?category=${entry.key}`}
            active={category === entry.key}
          >
            {entry.label}
          </ChipLink>
        ))}
      </nav>

      {sections.featured && (
        <section aria-labelledby="featured" className="mt-10 sm:mt-14">
          <h2 id="featured" className="sr-only">
            Featured
          </h2>
          <BlogCard
            blog={sections.featured}
            variant="feature"
            eyebrow="Featured"
            cover={covers.get(sections.featured.slug)}
            categoryLabels={categoryLabels}
            seriesTitle={titleFor(sections.featured.series_id)}
            priority
          />
        </section>
      )}

      {sections.trending.length > 0 && (
        <>
          <Rule className="mt-16" />
          <section aria-labelledby="trending" className="mt-12">
            <SectionHeading id="trending">Trending</SectionHeading>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {sections.trending.map((blog, index) => (
                <BlogCard
                  key={blog.id}
                  blog={blog}
                  variant="compact"
                  position={index}
                  cover={covers.get(blog.slug)}
                  categoryLabels={categoryLabels}
                  seriesTitle={titleFor(blog.series_id)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {sections.currentSeries && sections.currentSeries.blogs.length > 0 && (
        <>
          <Rule className="mt-16" />
          <section aria-labelledby="current-series" className="mt-12">
            <SectionHeading
              id="current-series"
              action={
                <Link
                  href={`/series/${sections.currentSeries.series.key}`}
                  className="text-meta text-muted underline underline-offset-4 hover:text-fg"
                >
                  View series
                </Link>
              }
            >
              Current series · {sections.currentSeries.series.title}
            </SectionHeading>

            {sections.currentSeries.series.description && (
              <p className="-mt-4 mb-8 max-w-2xl text-[0.9375rem] text-muted">
                {sections.currentSeries.series.description}
              </p>
            )}

            {/* A rail on small screens, a grid once there is room. Horizontal
                scroll on a phone beats three cards stacked to a mile. */}
            <div className="-mx-5 flex snap-x gap-6 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-10 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {sections.currentSeries.blogs.map((blog) => (
                <BlogCard
                  key={blog.id}
                  blog={blog}
                  variant="compact"
                  cover={covers.get(blog.slug)}
                  categoryLabels={categoryLabels}
                  seriesTitle={sections.currentSeries?.series.title}
                  className="w-[78vw] shrink-0 snap-start sm:w-auto"
                />
              ))}
            </div>
          </section>
        </>
      )}

      {sections.upcomingSeries.length > 0 && (
        <>
          <Rule className="mt-16" />
          <section aria-labelledby="upcoming-series" className="mt-12">
            <SectionHeading id="upcoming-series">Upcoming series</SectionHeading>
            <ul className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
              {sections.upcomingSeries.map((entry) => (
                <li key={entry.id} className="bg-bg p-6">
                  <Link href={`/series/${entry.key}`} className="group block">
                    <Eyebrow>Announced</Eyebrow>
                    <h3 className="mt-2 text-subheading font-semibold tracking-title transition-colors group-hover:text-muted">
                      {entry.title}
                    </h3>
                    {entry.description && (
                      <p className="mt-2 text-meta text-muted">{entry.description}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Rule className="mt-16" />
      <section aria-labelledby="all-articles" className="mt-12">
        <SectionHeading id="all-articles">
          {category ? `${categoryLabels.get(category) ?? category}` : "All articles"}
        </SectionHeading>

        <ul className="flex flex-col gap-12">
          {sections.all.map((blog, index) => (
            <li key={blog.id}>
              <BlogCard
                blog={blog}
                variant="split"
                position={index}
                cover={covers.get(blog.slug)}
                categoryLabels={categoryLabels}
                seriesTitle={titleFor(blog.series_id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {config.dataSource === "fixtures" && (
        <p className="mt-16 border-t border-rule pt-6 text-meta text-muted">
          Showing sample content. Set <code className="font-mono">BLOGS_DATA_SOURCE=api</code>{" "}
          to read from the backend.
        </p>
      )}
    </Container>
  );
}
