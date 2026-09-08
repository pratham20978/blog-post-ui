import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/app/providers/AuthProvider";

import { ArticleEngagement } from "./ArticleEngagement";

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  flush: vi.fn(),
  reading: {
    activeAnchor: null as string | null,
    progressRatio: 0,
    hasReaderMoved: false,
  },
  session: { status: "anonymous", actorId: "actor" } as Session,
}));

vi.mock("@/app/providers/EngagementProvider", () => ({
  useBeacon: () => ({ record: mocks.record, flush: mocks.flush }),
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ session: mocks.session }),
}));

vi.mock("@/features/marker/model/ReadingPositionProvider", () => ({
  useReadingPosition: () => mocks.reading,
}));

const blogId = "00000000-0000-7000-8000-000000000001";

function response(liked: boolean | null = null, likes = 3): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      message: "OK",
      error: null,
      data: {
        blog_id: blogId,
        member_view_count: 12,
        like_count: likes,
        liked_by_me: liked,
      },
    }),
  } as Response;
}

describe("ArticleEngagement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.record.mockReset();
    mocks.flush.mockReset();
    mocks.reading = { activeAnchor: null, progressRatio: 0, hasReaderMoved: false };
    mocks.session = { status: "anonymous", actorId: "actor" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("counts after ten visible seconds and only once", async () => {
    const view = render(
      <ArticleEngagement blogId={blogId} initialMemberViews={11} initialLikes={3} />,
    );
    await act(async () => vi.advanceTimersByTime(9_999));
    expect(mocks.record).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ blog_id: blogId, kind: "read", source: "direct" }),
    );
    expect(mocks.flush).toHaveBeenCalledTimes(1);

    view.rerender(
      <ArticleEngagement blogId={blogId} initialMemberViews={11} initialLikes={3} />,
    );
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("does not count hidden time", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    render(<ArticleEngagement blogId={blogId} initialMemberViews={0} initialLikes={0} />);
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(mocks.record).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("qualifies at 25 percent only after reader movement", async () => {
    mocks.reading = { activeAnchor: "part-one", progressRatio: 0.3, hasReaderMoved: true };
    render(<ArticleEngagement blogId={blogId} initialMemberViews={0} initialLikes={0} />);
    await act(async () => Promise.resolve());
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("prompts an anonymous reader instead of calling the like API", async () => {
    render(<ArticleEngagement blogId={blogId} initialMemberViews={12} initialLikes={3} />);
    await act(async () => Promise.resolve());
    expect(screen.getByRole("link", { name: "Sign in to like" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Like/ }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses idempotent PUT and applies the returned like state", async () => {
    vi.useRealTimers();
    mocks.session = {
      status: "authenticated",
      user: {
        id: "00000000-0000-7000-8000-000000000002",
        email: "reader@example.com",
        display_name: null,
        is_admin: false,
        status: "active",
        email_verified_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(false, 3))
      .mockResolvedValueOnce(response(true, 4));
    render(<ArticleEngagement blogId={blogId} initialMemberViews={12} initialLikes={3} />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole("button", { name: /Like/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Liked/ }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(`/blogs/${blogId}/like`),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("announces a failed like without changing the count", async () => {
    vi.useRealTimers();
    mocks.session = {
      status: "authenticated",
      user: {
        id: "00000000-0000-7000-8000-000000000002",
        email: "reader@example.com",
        display_name: null,
        is_admin: false,
        status: "active",
        email_verified_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(false, 3))
      .mockRejectedValueOnce(new Error("offline"));
    render(<ArticleEngagement blogId={blogId} initialMemberViews={12} initialLikes={3} />);
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole("button", { name: /Like/ }));

    expect(await screen.findByText("Your like could not be saved. Please try again.")).not
      .toBeNull();
    expect(screen.getByRole("button", { name: /Like · 3/ })).not.toBeNull();
  });
});
