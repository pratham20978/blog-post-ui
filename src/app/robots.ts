import type { MetadataRoute } from "next";

import { readServerConfig } from "@/shared/config";
import { absoluteUrl } from "@/shared/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = readServerConfig();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/signup", "/profile", "/search", "/email/"],
    },
    sitemap: absoluteUrl(siteUrl, "/sitemap.xml"),
  };
}
