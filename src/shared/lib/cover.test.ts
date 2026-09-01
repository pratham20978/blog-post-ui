import { describe, expect, it } from "vitest";

import { extractCover, typographicCover } from "./cover";

describe("extractCover", () => {
  it("finds a standard Markdown image", () => {
    const cover = extractCover("Intro text\n\n![A diagram](https://cdn.test/a.png)\n\nMore.");

    expect(cover).toEqual({ src: "https://cdn.test/a.png", alt: "A diagram" });
  });

  it("takes the first image when several are present", () => {
    const cover = extractCover(
      "![first](https://cdn.test/1.png)\n![second](https://cdn.test/2.png)",
    );

    expect(cover?.src).toBe("https://cdn.test/1.png");
  });

  it("ignores an image inside a fenced code block", () => {
    // The regression this guards: a tutorial whose first code sample shows
    // Markdown syntax would otherwise take its example URL as the cover.
    const markdown = [
      "Here is how you embed an image:",
      "",
      "```markdown",
      "![example](https://example.test/not-the-cover.png)",
      "```",
      "",
      "![real cover](https://cdn.test/real.png)",
    ].join("\n");

    expect(extractCover(markdown)?.src).toBe("https://cdn.test/real.png");
  });

  it("returns null when a code block holds the only image", () => {
    const markdown = "```\n![x](https://example.test/x.png)\n```";

    expect(extractCover(markdown)).toBeNull();
  });

  it("handles a title after the URL", () => {
    const cover = extractCover('![alt](https://cdn.test/a.png "A title")');

    expect(cover?.src).toBe("https://cdn.test/a.png");
  });

  it("handles an angle-bracketed URL", () => {
    expect(extractCover("![alt](<https://cdn.test/a.png>)")?.src).toBe(
      "https://cdn.test/a.png",
    );
  });

  it("reads an HTML img tag", () => {
    const cover = extractCover('<img src="https://cdn.test/a.png" alt="Inline" width="800">');

    expect(cover).toEqual({ src: "https://cdn.test/a.png", alt: "Inline" });
  });

  it("prefers whichever image appears first, Markdown or HTML", () => {
    const htmlFirst = '<img src="https://cdn.test/html.png">\n\n![md](https://cdn.test/md.png)';
    expect(extractCover(htmlFirst)?.src).toBe("https://cdn.test/html.png");

    const markdownFirst = '![md](https://cdn.test/md.png)\n\n<img src="https://cdn.test/html.png">';
    expect(extractCover(markdownFirst)?.src).toBe("https://cdn.test/md.png");
  });

  it("rejects a relative path", () => {
    // Authored against a repo layout, not this site's URL space — it would 404.
    expect(extractCover("![alt](./diagram.png)")).toBeNull();
    expect(extractCover("![alt](images/diagram.png)")).toBeNull();
  });

  it("accepts a root-relative path", () => {
    expect(extractCover("![alt](/media/diagram.png)")?.src).toBe("/media/diagram.png");
  });

  it("rejects a data URI", () => {
    const markdown = "![alt](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)";

    expect(extractCover(markdown)).toBeNull();
  });

  it("falls back to the supplied alt text when the image has none", () => {
    const cover = extractCover("![](https://cdn.test/a.png)", "Article title");

    expect(cover?.alt).toBe("Article title");
  });

  it("returns null for a body with no image, and for an empty body", () => {
    expect(extractCover("# Just a heading\n\nSome prose.")).toBeNull();
    expect(extractCover("")).toBeNull();
  });
});

describe("typographicCover", () => {
  it("is stable for a given slug", () => {
    const first = typographicCover({ slug: "retrieval", title: "Retrieval Without Embeddings" });
    const second = typographicCover({ slug: "retrieval", title: "Retrieval Without Embeddings" });

    // A cover that differed between the feed and the article page would read
    // as two different posts.
    expect(first).toEqual(second);
  });

  it("takes initials from the first two words", () => {
    expect(
      typographicCover({ slug: "x", title: "Retrieval Without Embeddings" }).initials,
    ).toBe("RW");
  });

  it("copes with a single-word title", () => {
    expect(typographicCover({ slug: "x", title: "Scaling" }).initials).toBe("S");
  });

  it("skips leading punctuation when taking initials", () => {
    expect(typographicCover({ slug: "x", title: '"Trust" and safety' }).initials).toBe("TA");
  });

  it("returns empty initials rather than throwing on a punctuation-only title", () => {
    expect(typographicCover({ slug: "x", title: "—" }).initials).toBe("");
  });

  it("varies orientation across slugs", () => {
    const orientations = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].map(
      (slug) => typographicCover({ slug, title: slug }).inverted,
    );

    // Not a strict alternation — just proof the hash is not constant.
    expect(new Set(orientations).size).toBe(2);
  });
});
