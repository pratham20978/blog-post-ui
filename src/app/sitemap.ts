import type { MetadataRoute } from "next";

import {
  fetchAllPublishedBlogs,
  fetchSeries,
} from "@/entities/blog/api/server";
import { readServerConfig } from "@/shared/config";
import { absoluteUrl } from "@/shared/lib/seo";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
