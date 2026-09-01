import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import type { BlogSection } from "@/shared/contracts";

import { rehypeBackendAnchors } from "./rehype-backend-anchors";

function section(anchor: string, ordinal: number, level = 2): BlogSection {
  return { anchor, ordinal, level, title: anchor, char_start: 0, char_end: 0 };
}

function render(markdown: string, sections: readonly BlogSection[]): string {
  return unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeBackendAnchors(sections))
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();
}

describe("rehypeBackendAnchors", () => {
  it("applies the backend anchor to each heading in order", () => {
    const html = render("## The problem\n\n## What we changed", [
      section("the-problem", 0),
      section("what-we-changed", 1),
    ]);

    expect(html).toContain('<h2 id="the-problem">The problem</h2>');
    expect(html).toContain('<h2 id="what-we-changed">What we changed</h2>');
  });

  it("uses the backend's disambiguating suffix rather than re-deriving one", () => {
    // The case that makes this plugin necessary: two identical headings. A
    // client-side slugifier would emit the same id twice, or invent its own
    // suffix scheme — and reference pins point at the backend's.
    const html = render("## Notes\n\ntext\n\n## Notes", [
      section("notes", 0),
      section("notes-2", 1),
    ]);

    expect(html).toContain('<h2 id="notes">Notes</h2>');
    expect(html).toContain('<h2 id="notes-2">Notes</h2>');
  });

  it("respects ordinal, not array order", () => {
    const html = render("## First\n\n## Second", [
      section("second", 1),
      section("first", 0),
    ]);

    expect(html).toContain('<h2 id="first">First</h2>');
    expect(html).toContain('<h2 id="second">Second</h2>');
  });

  it("pairs across heading levels in document order", () => {
    const html = render("# Title\n\n## Section\n\n### Detail", [
      section("title", 0, 1),
      section("section", 1, 2),
      section("detail", 2, 3),
    ]);

    expect(html).toContain('<h1 id="title">');
    expect(html).toContain('<h2 id="section">');
    expect(html).toContain('<h3 id="detail">');
  });

  it("leaves a heading unlabelled rather than guessing when sections run out", () => {
    // Better a missing anchor than a wrong one: a wrong id silently breaks a
    // marker that points at it.
    const html = render("## Known\n\n## Unknown", [section("known", 0)]);

    expect(html).toContain('<h2 id="known">Known</h2>');
    expect(html).toContain("<h2>Unknown</h2>");
  });

  it("ignores a heading written inside a code fence", () => {
    const html = render("```\n## Not a heading\n```\n\n## Real", [section("real", 0)]);

    expect(html).toContain('<h2 id="real">Real</h2>');
  });

  it("does nothing when there are no sections", () => {
    expect(render("## Anything", [])).toContain("<h2>Anything</h2>");
  });

  it("does not mutate the sections array it was given", () => {
    const sections = [section("b", 1), section("a", 0)];
    render("## A\n\n## B", sections);

    expect(sections.map((entry) => entry.anchor)).toEqual(["b", "a"]);
  });
});
