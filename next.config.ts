import type { NextConfig } from "next";

/**
 * Two things happen here, and both exist because of how the FastAPI backend
 * is built rather than by preference.
 *
 * `rewrites` is deliberately NOT used to reach the API. Every backend call
 * goes through the BFF route handler at /api/bff/[...path], which injects the
 * access and actor tokens from httpOnly cookies. A rewrite would forward the
 * browser's request verbatim — with no tokens, since the browser cannot read
 * them — so the proxy has to be real code, not a rewrite rule.
 *
 * The `/:slug/blog` redirect honours the URL shape the platform was specified
 * with while keeping `/blogs/[slug]` canonical.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  typedRoutes: true,

  images: {
    // Article covers are whatever URL the author put in the Markdown body, so
    // the host set is not knowable ahead of time. Remote images are optimised
    // over https only and never inlined as SVG (an SVG from an arbitrary host
    // is a script execution primitive).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    dangerouslyAllowSVG: false,
  },

  async redirects() {
    return [
      {
        source: "/:slug/blog",
        destination: "/blogs/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
