import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

import type { BlogSection } from "@/shared/contracts";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * Assign heading ids from the backend's stored sections.
 *
 * This exists instead of `rehype-slug`, and the difference is not cosmetic.
 *
 * The publish pipeline slugifies each heading itself, disambiguating repeats
 * with `-2`, `-3` suffixes, and stores the result in `blog_sections`. Those
 * exact strings are load-bearing: `reference_pins` has a composite foreign key
 * onto `(blog_id, anchor)`, and a section marker records where a reader
 * stopped by anchor. Re-deriving ids in the browser with a different slugify
 * would produce anchors that mostly match and occasionally do not — so most
 * deep links would work, and the ones pointing at a duplicated heading would
 * silently fail. That is the worst kind of broken.
 *
 * Matching is positional: headings in document order pair with sections in
 * `ordinal` order. The backend extracted its sections by walking the same
 * CommonMark token stream, so the sequences correspond. Any heading beyond the
 * end of the list is left without an id rather than given a guessed one.
 */
export function rehypeBackendAnchors(sections: readonly BlogSection[]) {
  const ordered = [...sections].sort((a, b) => a.ordinal - b.ordinal);

  return () => (tree: Root) => {
    let index = 0;

    visit(tree, "element", (node: Element) => {
      if (!HEADINGS.has(node.tagName)) return;

      const section = ordered[index];
      index += 1;
      if (!section) return;

      node.properties = { ...node.properties, id: section.anchor };
    });
  };
}
