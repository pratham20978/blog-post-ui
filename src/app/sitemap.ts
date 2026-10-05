import type { MetadataRoute } from "next";
import { connection } from "next/server";

import {
  fetchAllPublishedBlogs,
  fetchSeries,
} from "@/entities/blog/api/server";
import { readServerConfig } from "@/shared/config";
import { absoluteUrl } from "@/shared/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Request time only. Prerendered, it was built from the Dockerfile's fixture
  // data and served those fake URLs after every deploy until it revalidated.
  // The fetches keep their own data-cache lifetimes, so the API is not hit
  // on every request.
  await connection();
  const { siteUrl } = readServerConfig();
  const base: MetadataRoute.Sitemap = [
    { url: absoluteUrl(siteUrl, "/blogs"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(siteUrl, "/series"), changeFrequency: "weekly", priority: 0.7 },
  ];

  try {
    const [blogs, series] = await Promise.all([
      fetchAllPublishedBlogs(),
      fetchSeries(),
    ]);
    return [
      ...base,
      ...series.map((entry) => ({
        url: absoluteUrl(siteUrl, `/series/${entry.key}`),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...blogs.map((blog) => ({
        url: absoluteUrl(siteUrl, `/blogs/${blog.slug}`),
        lastModified: blog.content_updated_on ?? blog.updated_at,
        changeFrequency: "monthly" as const,
        priority: 0.8,
        ...(blog.cover_image_url && { images: [blog.cover_image_url] }),
      })),
    ];
  } catch {
    return base;
  }
}
