import type { BlogDetail } from "@/shared/contracts";

export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, `${siteUrl.replace(/\/$/, "")}/`).toString();
}

/** Keep canonical, Open Graph, sitemap, and JSON-LD on one local route. */
export function articleCanonical(
  blog: Pick<BlogDetail, "slug" | "canonical_url">,
  siteUrl: string,
): string {
  const expected = absoluteUrl(siteUrl, `/blogs/${blog.slug}`);
  if (!blog.canonical_url) return expected;

  try {
    const supplied = new URL(blog.canonical_url);
    return supplied.toString() === expected ? supplied.toString() : expected;
  } catch {
    return expected;
  }
}

export function blogPostingJsonLd(
  blog: BlogDetail,
  { siteName, siteUrl }: { siteName: string; siteUrl: string },
): Record<string, unknown> {
  const canonical = articleCanonical(blog, siteUrl);
  const published = blog.published_on ?? blog.published_at;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${canonical}#article`,
    mainEntityOfPage: canonical,
    url: canonical,
    headline: blog.title,
    ...(blog.summary && { description: blog.summary }),
    ...(published && { datePublished: published }),
    dateModified: blog.content_updated_on ?? blog.updated_at,
    ...(blog.cover_image_url && { image: [blog.cover_image_url] }),
    inLanguage: "en",
    wordCount: blog.word_count,
    keywords: blog.tag_keys.join(", "),
    articleSection: blog.category_keys,
    author: { "@type": "Organization", name: siteName, url: siteUrl },
    publisher: { "@type": "Organization", name: siteName, url: siteUrl },
    isPartOf: {
      "@type": "Blog",
      name: `${siteName} articles`,
      url: absoluteUrl(siteUrl, "/blogs"),
    },
  };
}
