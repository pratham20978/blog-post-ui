"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useConfig } from "@/app/providers/ConfigProvider";
import type { SearchCorpus } from "@/features/search/model/adapters";
import { SearchDialog, SearchIcon } from "@/features/search/ui/SearchDialog";
import { ThemeToggle } from "@/features/theme/ui/ThemeToggle";
import { Logo } from "@/shared/ui/Logo";

import { AccountMenu } from "./AccountMenu";

/**
 * Platform name, search, account.
 *
 * Sticky with a hairline bottom border and no shadow — the rule is the only
 * divider in the system, and a shadow here would be the one piece of chrome on
 * an otherwise flat page.
 */
export function SiteHeader({ corpus }: { corpus: SearchCorpus }) {
  const { siteName } = useConfig();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl-K, the shortcut people already try.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-rule bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-5 sm:px-8">
          <Link
            href="/blogs"
            aria-label={`${siteName} — home`}
            className="text-fg transition-opacity hover:opacity-70"
          >
            {/* `h-7` puts the lockup at ~120px wide, just above the 100px
                minimum in brand/README.md. It inherits `currentColor`, so it
                turns white in the dark theme with no second asset. */}
            <Logo className="h-7 w-auto" title={siteName} />
          </Link>

          <nav aria-label="Main" className="ml-6 hidden items-center gap-6 md:flex">
            <HeaderLink href="/blogs">Articles</HeaderLink>
            <HeaderLink href="/series">Series</HeaderLink>
          </nav>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-control border border-rule px-3 text-meta text-muted transition-colors hover:border-fg-subtle hover:text-fg"
            aria-label="Search articles"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden border border-rule px-1 text-eyebrow lg:inline">⌘K</kbd>
          </button>

          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {/* Mounted only while open, so closing it discards the dialog's query
          and results without any reset logic. */}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} corpus={corpus} />}
    </>
  );
}

function HeaderLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[0.9375rem] text-muted transition-colors hover:text-fg"
    >
      {children}
    </Link>
  );
}
