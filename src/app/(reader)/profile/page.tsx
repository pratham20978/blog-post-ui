import type { Metadata } from "next";

import { fetchFeedSafe } from "@/entities/blog/api/server";
import { getServerSession } from "@/features/auth/server/session";
import { SignOutButtons } from "@/features/auth/ui/SignOutButtons";
import { EmailPreferenceControl } from "@/features/announcement/ui/EmailPreferenceControl";
import { routes } from "@/shared/api/routes";
import { serverFetchOptional } from "@/shared/api/server";
import { dataSource } from "@/shared/config";
import type {
  BlogEmailPreference,
  BlogSummary,
  Catalog,
  Marker,
  RecentView,
} from "@/shared/contracts";
import { formatDate } from "@/shared/lib/date";
import { ButtonLink } from "@/shared/ui/Button";
import { Container, Eyebrow, Rule, SectionHeading } from "@/shared/ui/primitives";
import { ReadingListButton } from "@/widgets/ReadingList/ReadingListButton";
import { ReadingRow, type ReadingListEntry } from "@/widgets/ReadingList/ReadingRow";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

/** Rows each list shows before "View all" takes over. */
const PREVIEW_COUNT = 5;

export default async function ProfilePage() {
  const session = await getServerSession();

  if (session.status === "loading") {
    return (
      <Container className="py-24 text-center" aria-live="polite">
        <Eyebrow>Profile</Eyebrow>
        <h1 className="mt-4 text-title font-semibold tracking-title">
          Restoring your session…
        </h1>
      </Container>
    );
  }

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
  const [markers, catalogs, recent, feed, emailPreference] = usingFixtures
    ? ([
        [],
        [],
        [],
        { items: [] },
        {
          user_id: user.id,
          blog_announcements_enabled: true,
          updated_at: user.updated_at,
        },
      ] as const)
    : await Promise.all([
        serverFetchOptional<readonly Marker[]>(routes.markers()).then((v) => v ?? []),
        serverFetchOptional<readonly Catalog[]>(routes.catalogs()).then((v) => v ?? []),
        serverFetchOptional<readonly RecentView[]>(routes.recentViews()).then((v) => v ?? []),
        fetchFeedSafe({ limit: 100 }),
        serverFetchOptional<BlogEmailPreference>(routes.emailPreferences()),
      ]);

  const blogsById = new Map(feed.items.map((blog) => [blog.id, blog]));

  // A marker whose article we cannot name is dropped rather than rendered as a
  // bare UUID. It means the article fell outside the fetched window or was
  // archived — either way there is nothing useful to show.
  const inProgress: readonly ReadingListEntry[] = markers
    .map((marker) => ({ marker, blog: blogsById.get(marker.blog_id) }))
    .filter((entry): entry is { marker: Marker; blog: BlogSummary } => Boolean(entry.blog))
    .map(({ marker, blog }) => ({
      id: blog.id,
      title: blog.title,
      href: markerHref(blog, marker),
      at: marker.updated_at,
      progress: marker.progress_ratio,
    }));

  const recentlyRead: readonly ReadingListEntry[] = recent.map((view) => ({
    id: view.blog_id,
    title: view.title,
    href: `/blogs/${view.slug}`,
    at: view.last_viewed_at,
    progress: null,
  }));

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

      <ReadingListSection
        id="continue"
        title="Continue reading"
        entries={inProgress}
        searchLabel="Search articles in progress"
        emptyMessage="Nothing in progress. Your place is saved automatically as you read."
      />

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

      <ReadingListSection
        id="recent"
        title="Recently read"
        entries={recentlyRead}
        searchLabel="Search your reading history"
        emptyMessage="Nothing yet."
      />

      <Rule className="mt-12" />

      {emailPreference && (
        <section aria-labelledby="email-preferences" className="mt-12">
          <SectionHeading id="email-preferences">Email preferences</SectionHeading>
          <EmailPreferenceControl initialPreference={emailPreference} />
        </section>
      )}

      <Rule className="mt-12" />

      <section aria-labelledby="session" className="mt-12">
        <SectionHeading id="session">Session</SectionHeading>
        <SignOutButtons />
      </section>
    </Container>
  );
}

/**
 * A reading list, previewed: the first few rows render here on the server, and
 * "View all" opens the whole list — searchable — once there is more to see.
 */
function ReadingListSection({
  id,
  title,
  entries,
  searchLabel,
  emptyMessage,
}: {
  id: string;
  title: string;
  entries: readonly ReadingListEntry[];
  searchLabel: string;
  emptyMessage: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <SectionHeading
        id={id}
        action={
          entries.length > PREVIEW_COUNT ? (
            <ReadingListButton title={title} entries={entries} searchLabel={searchLabel} />
          ) : undefined
        }
      >
        {title}
      </SectionHeading>

      {entries.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <ul className="flex flex-col">
          {entries.slice(0, PREVIEW_COUNT).map((entry) => (
            <li key={entry.id} className="border-b border-rule last:border-b-0">
              <ReadingRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-rule bg-surface px-5 py-8 text-center text-[0.9375rem] text-muted">
      {children}
    </p>
  );
}

function markerHref(blog: BlogSummary, marker: Marker): `/blogs/${string}` {
  const hash = marker.anchor.kind === "section" ? `#${marker.anchor.anchor}` : "";
  return `/blogs/${blog.slug}${hash}`;
}
