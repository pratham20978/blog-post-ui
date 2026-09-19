import { describe, expect, it } from "vitest";

import type { BlogDetail } from "@/shared/contracts";

import { articleCanonical, blogPostingJsonLd } from "./seo";

const blog = {
  id: "0198f0e2-3b7a-7c31-9f52-100000000001",
  slug: "canonical-test",
  canonical_url: "https://canery.in/p/canonical-test",
  title: "Canonical test",
  summary: "A summary",
  status: "published",
  author_id: "0198f0e2-3b7a-7c31-9f52-100000000002",
  series_id: null,
  series_position: null,
  published_on: "2026-09-10",
  published_at: "2026-09-10T00:00:00Z",
  content_updated_on: "2026-09-12",
  updated_at: "2026-09-12T00:00:00Z",
  created_at: "2026-09-10T00:00:00Z",
  cover_image_url: null,
  cover_image_alt: null,
  tier: "L1",
  difficulty: "beginner",
  prerequisites: [],
  sections: [],
  markdown_uri: "s3://media/canonical-test.md",
  content_sha256: "a".repeat(64),
  word_count: 800,
  reading_minutes: 4,
  unique_reader_count: 0,
  member_view_count: 0,
  like_count: 0,
  tag_keys: ["seo"],
  category_keys: ["software-engineering"],
} as BlogDetail;

describe("SEO metadata", () => {
  it("repairs a persisted legacy canonical", () => {
    expect(articleCanonical(blog, "https://canery.in")).toBe(
      "https://canery.in/blogs/canonical-test",
    );
  });

  it("keeps structured data on the canonical URL", () => {
    const result = blogPostingJsonLd(blog, {
      siteName: "Canery",
      siteUrl: "https://canery.in",
    });

    expect(result.url).toBe("https://canery.in/blogs/canonical-test");
    expect(result["@type"]).toBe("BlogPosting");
  });
});
