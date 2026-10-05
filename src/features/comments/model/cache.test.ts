import { describe, expect, it } from "vitest";

import type { Comment, CommentThread } from "@/shared/contracts";

import { withEdited, withNewReply, withNewRoot, withoutComment, type CommentPages } from "./cache";

function comment(id: string, overrides: Partial<Comment> = {}): Comment {
  return {
    id,
    blog_id: "00000000-0000-7000-8000-00000000b106",
    user_id: "00000000-0000-7000-8000-000000000001",
    author_name: null,
    parent_comment_id: null,
    depth: 0,
    body: id,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function reply(id: string, parent: string): Comment {
  return comment(id, { parent_comment_id: parent, depth: 1 });
}

function pages(...groups: CommentThread[][]): CommentPages {
  return {
    pages: groups.map((items, index) => ({
      items,
      next_cursor: index < groups.length - 1 ? `cursor-${index}` : null,
      has_more: index < groups.length - 1,
    })),
    pageParams: groups.map((_, index) => (index === 0 ? null : `cursor-${index - 1}`)),
  };
}

/** Each page as `root>reply>reply` strings — the whole shape in one assertion. */
function shape(data: CommentPages) {
  return data.pages.map((page) =>
    page.items.map(({ root, replies }) => [root.id, ...replies.map((entry) => entry.id)].join(">")),
  );
}

describe("comment cache updates", () => {
  const loaded = pages(
    [
      { root: comment("a"), replies: [reply("a1", "a")] },
      { root: comment("b"), replies: [] },
    ],
    [{ root: comment("c"), replies: [] }],
  );

  it("puts a new root comment first, matching the newest-first listing", () => {
    expect(shape(withNewRoot(loaded, comment("new")))).toEqual([["new", "a>a1", "b"], ["c"]]);
  });

  it("ends the right thread with a new reply, whichever page it is on", () => {
    expect(shape(withNewReply(loaded, reply("c1", "c")))).toEqual([["a>a1", "b"], ["c>c1"]]);
    expect(shape(withNewReply(loaded, reply("a2", "a")))).toEqual([["a>a1>a2", "b"], ["c"]]);
  });

  it("replaces an edited root or reply where it sits", () => {
    const root = withEdited(loaded, comment("b", { body: "changed" }));
    expect(root.pages[0]?.items[1]?.root.body).toBe("changed");

    const nested = withEdited(loaded, { ...reply("a1", "a"), body: "changed too" });
    expect(nested.pages[0]?.items[0]?.replies[0]?.body).toBe("changed too");
    expect(shape(nested)).toEqual(shape(loaded));
  });

  it("drops a deleted reply alone, and a deleted root with its whole thread", () => {
    expect(shape(withoutComment(loaded, "a1"))).toEqual([["a", "b"], ["c"]]);
    expect(shape(withoutComment(loaded, "a"))).toEqual([["b"], ["c"]]);
  });

  it("keeps cursors and leaves the cached input untouched", () => {
    const before = JSON.stringify(loaded);
    const after = withNewRoot(withoutComment(loaded, "a"), comment("new"));

    expect(after.pageParams).toEqual(loaded.pageParams);
    expect(after.pages.map((page) => page.next_cursor)).toEqual(["cursor-0", null]);
    expect(JSON.stringify(loaded)).toBe(before);
  });
});
