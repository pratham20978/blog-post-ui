import type { Metadata } from "next";
import Link from "next/link";

import { fetchFeedSafe } from "@/entities/blog/api/server";
import { getServerSession } from "@/features/auth/server/session";
import { SignOutButtons } from "@/features/auth/ui/SignOutButtons";
import { routes } from "@/shared/api/routes";
import { serverFetchOptional } from "@/shared/api/server";
import { dataSource } from "@/shared/config";
import type { BlogSummary, Catalog, Marker, RecentView } from "@/shared/contracts";
import { formatDate, formatRelative } from "@/shared/lib/date";
import { ButtonLink } from "@/shared/ui/Button";
import { Container, Eyebrow, Rule, SectionHeading } from "@/shared/ui/primitives";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getServerSession();

  if (session.status !== "authenticated") {
    return (
      <Container className="py-24 text-center">
        <Eyebrow>Profile</Eyebrow>
        <h1 className="mt-4 text-title font-semibold tracking-title">Sign in to continue</h1>
        <p className="mx-auto mt-3 max-w-md text-[0.9375rem] text-muted">
          Your saved articles, reading positions and history live here.
        </p>
        <ButtonLink href="/login" className="mt-8">
          Sign in
        </ButtonLink>
      </Container>
    );
  }

  const { user } = session;
  const usingFixtures = dataSource() === "fixtures";

  // Each is optional: a failure in any one of them should not take down the
  // page, so a missing section renders empty rather than erroring.
  //
  // The feed is fetched alongside them because `Marker` carries only a
  // `blog_id` — no title, no slug — and there is no get-blog-by-id route. The
  // feed is the only way to turn a marker into something a reader recognises.
  const [markers, catalogs, recent, feed] = usingFixtures
    ? ([[], [], [], { items: [] }] as const)
    : await Promise.all([
        serverFetchOptional<readonly Marker[]>(routes.markers()).then((v) => v ?? []),
        serverFetchOptional<readonly Catalog[]>(routes.catalogs()).then((v) => v ?? []),
        serverFetchOptional<readonly RecentView[]>(routes.recentViews()).then((v) => v ?? []),
        fetchFeedSafe({ limit: 100 }),
      ]);

  const blogsById = new Map(feed.items.map((blog) => [blog.id, blog]));

  // A marker whose article we cannot name is dropped rather than rendered as a
  // bare UUID. It means the article fell outside the fetched window or was
  // archived — either way there is nothing useful to show.
  const resolvedMarkers = markers
    .map((marker) => ({ marker, blog: blogsById.get(marker.blog_id) }))
    .filter((entry): entry is { marker: Marker; blog: BlogSummary } => Boolean(entry.blog));

  return (
    <Container className="pb-20 pt-10 sm:pt-14">
      <header className="max-w-2xl">
        <Eyebrow>Profile</Eyebrow>
        <h1 className="mt-3 text-display font-semibold leading-display tracking-display">
          {user.display_name ?? user.email}
        </h1>
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-meta">
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="mt-1 text-fg">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted">Member since</dt>
            <dd className="mt-1 text-fg">{formatDate(user.created_at)}</dd>
          </div>
        </dl>

        {/*
          There is no profile-update endpoint on the API — `User` is read-only
          over HTTP and `display_name` only ever arrives from an OAuth profile.
          Saying so is better than showing an Edit button that cannot work.
        */}
        <p className="mt-4 text-meta text-muted">
          Profile details come from your sign-in provider and cannot be edited here.
        </p>
      </header>

      <Rule className="mt-12" />

      <section aria-labelledby="continue" className="mt-12">
        <SectionHeading id="continue">Continue reading</SectionHeading>
        {resolvedMarkers.length === 0 ? (
          <EmptyState>
            Nothing in progress. Your place is saved automatically as you read.
          </EmptyState>
        ) : (
          <ul className="flex flex-col">
            {resolvedMarkers.map(({ marker, blog }) => (
              <li key={marker.blog_id} className="border-b border-rule last:border-b-0">
                <Link href={`/blogs/${blog.slug}`} className="group block py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[0.9375rem] text-fg transition-colors group-hover:text-muted">
                      {blog.title}
                    </span>
                    <span className="shrink-0 text-meta text-muted">
                      {formatRelative(marker.updated_at)}
                    </span>
                  </div>

                  {marker.progress_ratio !== null && (
                    <div
                      className="mt-3 h-px w-full bg-rule"
                      role="progressbar"
                      aria-valuenow={Math.round(marker.progress_ratio * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Reading progress for ${blog.title}`}
                    >
                      <div
                        className="h-px bg-fg"
                        style={{ width: `${marker.progress_ratio * 100}%` }}
                      />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rule className="mt-12" />

      <section aria-labelledby="saved" className="mt-12">
        <SectionHeading id="saved">Saved</SectionHeading>
        {catalogs.length === 0 ? (
          <EmptyState>
            No collections yet. Saving an article creates one automatically.
          </EmptyState>
        ) : (
          <ul className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {catalogs.map((catalog) => (
              <li key={catalog.id} className="bg-bg p-6">
                <h3 className="text-subheading font-semibold tracking-title">{catalog.name}</h3>
                <p className="mt-1 text-meta text-muted">
                  {catalog.item_count} {catalog.item_count === 1 ? "article" : "articles"}
                  {catalog.is_default && " · Default"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rule className="mt-12" />

      <section aria-labelledby="recent" className="mt-12">
        <SectionHeading id="recent">Recently read</SectionHeading>
        {recent.length === 0 ? (
          <EmptyState>Nothing yet.</EmptyState>
        ) : (
          <ul className="flex flex-col">
            {recent.map((view) => (
              <li key={view.blog_id} className="border-b border-rule last:border-b-0">
                <Link
                  href={`/blogs/${view.slug}`}
                  className="group flex items-baseline justify-between gap-4 py-4"
                >
                  <span className="text-[0.9375rem] text-fg transition-colors group-hover:text-muted">
                    {view.title}
                  </span>
                  <span className="shrink-0 text-meta text-muted">
                    {formatRelative(view.last_viewed_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rule className="mt-12" />

      <section aria-labelledby="session" className="mt-12">
        <SectionHeading id="session">Session</SectionHeading>
        <SignOutButtons />
      </section>
    </Container>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-rule bg-surface px-5 py-8 text-center text-[0.9375rem] text-muted">
      {children}
    </p>
  );
}
