import type { ReactNode } from "react";

import { fetchCategories, fetchFeedSafe, fetchSeries } from "@/entities/blog/api/server";
import { getServerSession } from "@/features/auth/server/session";
import { readServerConfig } from "@/shared/config";
import { SiteFooter } from "@/widgets/SiteFooter/SiteFooter";
import { SiteHeader } from "@/widgets/SiteHeader/SiteHeader";

/**
 * The reading shell: header, page, footer.
 *
 * The header's search corpus and the footer's link columns both need the
 * taxonomy, so it is fetched once here rather than per page. All three calls
 * run in parallel — awaited in sequence they would triple the layout's time to
 * first byte for no reason.
 *
 * Every one of them degrades to empty rather than throwing. A layout that
 * throws takes down every route beneath it *including the error screen*, so
 * the site would answer a bare 500 with no navigation instead of explaining
 * itself. Here a backend outage costs the search corpus and the footer's link
 * columns; the shell still renders, and the page inside it reports the real
 * failure.
 */
export default async function ReaderLayout({ children }: { children: ReactNode }) {
  const config = readServerConfig();

  const [feed, categories, series, session] = await Promise.all([
    fetchFeedSafe({ limit: 50 }),
    fetchCategories(),
    fetchSeries(),
    getServerSession(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader corpus={{ blogs: feed.items, categories, series }} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter
        siteName={config.siteName}
        categories={categories}
        series={series}
        signedIn={session.status === "authenticated"}
      />
    </div>
  );
}
