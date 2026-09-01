import Link from "next/link";
import type { ReactNode } from "react";

import { readServerConfig } from "@/shared/config";
import { Logo } from "@/shared/ui/Logo";

/**
 * A deliberately bare shell. No header, no footer, no navigation — the only
 * thing to do on this page is sign in, and the site name links back out for
 * anyone who arrived by accident.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { siteName } = readServerConfig();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-5 py-6 sm:px-8">
        <Link
          href="/blogs"
          aria-label={`${siteName} — home`}
          className="inline-block transition-opacity hover:opacity-70"
        >
          <Logo className="h-7 w-auto" title={siteName} />
        </Link>
      </div>

      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-20 pt-8 sm:pt-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
