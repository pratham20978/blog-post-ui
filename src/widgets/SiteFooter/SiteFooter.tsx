import type { Route } from "next";
import Link from "next/link";

import type { Category, Series } from "@/shared/contracts";
import { Container } from "@/shared/ui/primitives";

/**
 * Four link columns, a social row, then a legal row on a hairline — the Meta
 * AI blog structure, in `--muted` with no background fill so the footer reads
 * as the end of the page rather than a separate slab.
 *
 * Series and categories come from the API, so the footer is a real navigation
 * surface rather than a hard-coded list that drifts.
 */
export function SiteFooter({
  siteName,
  categories,
  series,
  signedIn = false,
}: {
  siteName: string;
  categories: readonly Category[];
  series: readonly Series[];
  signedIn?: boolean;
}) {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="mt-[var(--section-gap)] border-t border-rule">
      <Container width="wide" className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="Platform">
            <FooterLink href="/blogs">All articles</FooterLink>
            <FooterLink href="/series">Series</FooterLink>
            <FooterLink href="/search">Search</FooterLink>
          </FooterColumn>

          <FooterColumn title="Series">
            {series.slice(0, 5).map((entry) => (
              <FooterLink key={entry.id} href={`/series/${entry.key}`}>
                {entry.title}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Categories">
            {categories.slice(0, 5).map((entry) => (
              <FooterLink key={entry.key} href={`/blogs?category=${entry.key}`}>
                {entry.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Account">
            {/* Offering "Sign in" to someone already signed in reads as the
                session having been lost. */}
            {!signedIn && (
              <>
                <FooterLink href="/login">Sign in</FooterLink>
                <FooterLink href="/signup">Create an account</FooterLink>
              </>
            )}
            <FooterLink href="/profile">Profile</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-meta text-muted">
            {siteName} © {year}
          </p>
          {/* No legal links yet: pointing at pages that do not exist is worse
              than omitting the row until there is something to link to. */}
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-eyebrow font-medium uppercase tracking-eyebrow text-fg">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3">{children}</ul>
    </div>
  );
}

// Generic so a dynamic href like `/series/${key}` type-checks: the bare
// `Route` union only admits concrete literals.
function FooterLink<T extends string>({
  href,
  children,
}: {
  href: Route<T>;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="text-meta text-muted transition-colors hover:text-fg">
        {children}
      </Link>
    </li>
  );
}
