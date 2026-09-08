import { describe, expect, it } from "vitest";

import { typographicCover } from "./cover";

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
