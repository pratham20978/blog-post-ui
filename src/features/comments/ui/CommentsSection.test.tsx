import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/app/providers/AuthProvider";
import type { Comment, CommentThread, ErrorEnvelope, User } from "@/shared/contracts";

import { CommentsSection } from "./CommentsSection";

const mocks = vi.hoisted(() => ({
  session: { status: "anonymous", actorId: null } as Session,
  toast: vi.fn(),
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    session: mocks.session,
    user: mocks.session.status === "authenticated" ? mocks.session.user : null,
  }),
}));
vi.mock("@/app/providers/ConfigProvider", () => ({ useConfig: () => ({ dataSource: "api" }) }));
vi.mock("@/app/providers/ToastProvider", () => ({ useToast: () => ({ toast: mocks.toast }) }));

const BLOG = "00000000-0000-7000-8000-00000000b106";
const AUTHOR = "00000000-0000-7000-8000-0000000a0001";
const READER = "00000000-0000-7000-8000-0000000b0002";

function user(id: string, displayName: string | null): User {
  return {
    id,
    email: "reader@example.com",
    display_name: displayName,
    is_admin: false,
    status: "active",
    email_verified_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function comment(id: string, userId: string, overrides: Partial<Comment> = {}): Comment {
  return {
    id,
    blog_id: BLOG,
    user_id: userId,
    author_name: null,
    parent_comment_id: null,
    depth: 0,
    body: `Body of ${id}`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function envelope(data: unknown, status = 200, error: ErrorEnvelope | null = null): Response {
  return new Response(
    JSON.stringify({ success: error === null, message: "OK", data: error ? null : data, error }),
    { status, headers: { "content-type": "application/json" } },
  );
}

type Handler = (body: unknown, url: string) => Response;

/** Serves the listing for GET and hands writes to the handler for their method. */
function serve(threads: CommentThread[], handlers: Partial<Record<string, Handler>> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") return envelope({ items: threads, next_cursor: null, has_more: false });
      const handler = handlers[method];
      if (!handler) throw new Error(`unexpected ${method} ${url}`);
      return handler(init?.body ? JSON.parse(String(init.body)) : null, url);
    }),
  );
}

/** jsdom has no IntersectionObserver. This one reports everything in view. */
class InstantObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CommentsSection blogId={BLOG} authorId={AUTHOR} />
    </QueryClientProvider>,
  );
}

describe("CommentsSection", () => {
  beforeEach(() => {
    mocks.session = { status: "anonymous", actorId: null };
    mocks.toast.mockReset();
    vi.stubGlobal("IntersectionObserver", InstantObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows threads with names, the author's badge and replies, and invites sign-in", async () => {
    serve([
      {
        root: comment("r1", READER, { author_name: "Grace", body: "Great read." }),
        replies: [
          comment("p1", AUTHOR, {
            author_name: "Pratham",
            parent_comment_id: "r1",
            depth: 1,
            body: "Thank you!",
          }),
        ],
      },
    ]);
    renderSection();

    const root = await screen.findByRole("article", { name: "Comment by Grace" });
    expect(within(root).getByText("Great read.")).not.toBeNull();
    expect(within(root).queryByText("Author")).toBeNull();

    const answer = screen.getByRole("article", { name: "Comment by Pratham" });
    expect(within(answer).getByText("Author")).not.toBeNull();

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("posts a comment, shows it first, and then gives way to the one-comment note", async () => {
    mocks.session = { status: "authenticated", user: user(READER, null) };
    serve([{ root: comment("r0", AUTHOR, { author_name: "Pratham" }), replies: [] }], {
      POST: (body) => envelope(comment("r1", READER, { body: (body as { body: string }).body })),
    });
    renderSection();

    const box = await screen.findByRole("textbox", { name: "Add a comment" });
    expect(screen.getByText("Posting as Reader 0002")).not.toBeNull();

    fireEvent.change(box, { target: { value: "  Loved the diagrams.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    const mine = await screen.findByRole("article", { name: "Comment by Reader 0002" });
    expect(within(mine).getByText("Loved the diagrams.")).not.toBeNull();
    expect(within(mine).getByText("You")).not.toBeNull();
    expect(screen.getAllByRole("article")[0]).toBe(mine);

    expect(fetch).toHaveBeenLastCalledWith(
      `/api/bff/blogs/${BLOG}/comments`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: "Loved the diagrams." }),
      }),
    );
    expect(screen.queryByRole("textbox", { name: "Add a comment" })).toBeNull();
    expect(screen.getByText(/You have commented on this article/)).not.toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith("Comment posted.");
  });

  it("explains the one-comment rule, keeping the text, when the server refuses", async () => {
    mocks.session = { status: "authenticated", user: user(READER, "Grace") };
    serve([], {
      POST: () =>
        envelope(null, 409, {
          category: "COMMENT_ALREADY_EXISTS",
          safe_message: "Already commented.",
          retryability: "NOT_RETRYABLE",
          stage: "PERSIST",
          safe_details: {},
          correlation_id: "correlation",
        }),
    });
    renderSection();

    const box = await screen.findByRole("textbox", { name: "Add a comment" });
    fireEvent.change(box, { target: { value: "Second thoughts" } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/already commented/);
    expect((box as HTMLTextAreaElement).value).toBe("Second thoughts");
  });

  it("offers edit and delete on the reader's own comment and nobody else's", async () => {
    mocks.session = { status: "authenticated", user: user(READER, "Grace") };
    serve([
      { root: comment("r1", READER, { author_name: "Grace" }), replies: [] },
      { root: comment("r2", AUTHOR, { author_name: "Pratham" }), replies: [] },
    ]);
    renderSection();

    const mine = await screen.findByRole("article", { name: "Comment by Grace" });
    const theirs = screen.getByRole("article", { name: "Comment by Pratham" });

    expect(within(mine).getByRole("button", { name: "Edit" })).not.toBeNull();
    expect(within(mine).getByRole("button", { name: "Delete" })).not.toBeNull();
    expect(within(theirs).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(theirs).queryByRole("button", { name: "Delete" })).toBeNull();
    expect(within(theirs).getByRole("button", { name: "Reply" })).not.toBeNull();
  });

  it("edits a comment in place", async () => {
    mocks.session = { status: "authenticated", user: user(READER, "Grace") };
    serve([{ root: comment("r1", READER, { author_name: "Grace", body: "Frist!" }), replies: [] }], {
      PATCH: (body) =>
        envelope(
          comment("r1", READER, {
            author_name: "Grace",
            body: (body as { body: string }).body,
            updated_at: "2026-01-01T00:10:00Z",
          }),
        ),
    });
    renderSection();

    const mine = await screen.findByRole("article", { name: "Comment by Grace" });
    fireEvent.click(within(mine).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(mine).getByRole("textbox", { name: "Edit your comment" }), {
      target: { value: "First!" },
    });
    fireEvent.click(within(mine).getByRole("button", { name: "Save" }));

    // Not `findByText("First!")`: React mirrors a controlled textarea's value
    // into its text, so that would match the form before the save landed.
    expect(await within(mine).findByText("· edited")).not.toBeNull();
    expect(within(mine).queryByRole("textbox")).toBeNull();
    expect(within(mine).getByText("First!")).not.toBeNull();
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/bff/comments/r1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ body: "First!" }) }),
    );
  });

  it("deletes a comment only after confirmation", async () => {
    mocks.session = { status: "authenticated", user: user(READER, "Grace") };
    serve([{ root: comment("r1", READER, { author_name: "Grace" }), replies: [] }], {
      DELETE: () => envelope({ comment_id: "r1" }),
    });
    renderSection();

    const mine = await screen.findByRole("article", { name: "Comment by Grace" });
    fireEvent.click(within(mine).getByRole("button", { name: "Delete" }));
    expect(fetch).toHaveBeenCalledTimes(1);

    const confirm = within(mine).getByRole("group", { name: "Confirm deletion" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("No comments yet.")).not.toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith("Comment deleted.");
  });
});
