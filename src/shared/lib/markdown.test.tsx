import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BlogSection } from "@/shared/contracts";

import { Article } from "./markdown";

function section(anchor: string, ordinal: number, level = 2): BlogSection {
  return { anchor, ordinal, level, title: anchor, char_start: 0, char_end: 0 };
}

describe("Article", () => {
  it("gives headings the backend anchor verbatim, with no sanitiser prefix", () => {
    // The regression this exists for: with the plugins in the other order,
    // rehype-sanitize rewrites ids to `user-content-<anchor>` as a
    // DOM-clobbering guard, and every TOC link, deep link and section marker
    // silently points at an element that no longer carries that id.
    const { container } = render(
      <Article
        markdown={"## The problem\n\nBody.\n\n## What we changed\n\nMore."}
        sections={[section("the-problem", 0), section("what-we-changed", 1)]}
      />,
    );

    const ids = [...container.querySelectorAll("h2")].map((node) => node.id);

    expect(ids).toEqual(["the-problem", "what-we-changed"]);
    expect(ids.some((id) => id.startsWith("user-content-"))).toBe(false);
  });

  it("keeps the backend's disambiguating suffix for repeated headings", () => {
    const { container } = render(
      <Article
        markdown={"## Notes\n\na\n\n## Notes\n\nb"}
        sections={[section("notes", 0), section("notes-2", 1)]}
      />,
    );

    expect([...container.querySelectorAll("h2")].map((node) => node.id)).toEqual([
      "notes",
      "notes-2",
    ]);
  });

  it("still strips dangerous author markup", () => {
    const { container } = render(
      <Article
        markdown={'<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\nSafe text.'}
        sections={[]}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.textContent).toContain("Safe text.");
  });

  it("renders GFM tables", () => {
    const { container } = render(
      <Article
        markdown={"| A | B |\n| --- | --- |\n| 1 | 2 |"}
        sections={[]}
      />,
    );

    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("th")).toHaveLength(2);
  });

  it("opens external links safely and keeps internal ones in-app", () => {
    const { container } = render(
      <Article
        markdown={"[out](https://example.test) and [in](/blogs/other)"}
        sections={[]}
      />,
    );

    const [external, internal] = [...container.querySelectorAll("a")];

    expect(external?.getAttribute("target")).toBe("_blank");
    // Without `noopener` the opened page can reach back through window.opener.
    expect(external?.getAttribute("rel")).toContain("noopener");

    expect(internal?.getAttribute("href")).toBe("/blogs/other");
    expect(internal?.getAttribute("target")).toBeNull();
  });
});
