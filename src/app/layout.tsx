import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import type { ReactNode } from "react";

import { getServerSession } from "@/features/auth/server/session";
import { readServerConfig } from "@/shared/config";

import { AppProviders } from "./providers/AppProviders";
import { themeScript } from "./providers/theme-script";

import "./globals.css";

/**
 * Both faces are self-hosted by next/font: the files are downloaded at build
 * time and served from our own origin. No request to Google at runtime, no
 * third-party connection for a reader to be tracked through, and `swap` plus
 * an adjusted fallback keeps the layout from shifting when they land.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  // The article body only ever uses regular and italic; loading the rest
  // would be bytes nothing renders.
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const config = readServerConfig();

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: config.siteName,
    template: `%s · ${config.siteName}`,
  },
  description: "Essays and series on building software.",
  openGraph: {
    type: "website",
    siteName: config.siteName,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Both themes are declared so the browser paints its own chrome — address
  // bar, scrollbars — to match before our CSS loads.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  return (
    // `suppressHydrationWarning` is required and narrow: the inline script
    // below sets `data-theme` and `style` on this element before React
    // hydrates, so the server markup and the live DOM legitimately differ on
    // exactly this node. It suppresses nothing inside <body>.
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Must run before first paint, so it is inline and in <head> rather
          than a component. Anything later — including a beforeInteractive
          Script — paints the light theme first and flashes.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-fg focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>

        <AppProviders config={config} initialSession={session}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
