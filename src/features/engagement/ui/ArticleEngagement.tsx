"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useBeacon } from "@/app/providers/EngagementProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReadingPosition } from "@/features/marker/model/ReadingPositionProvider";
import { BFF_BASE, routes } from "@/shared/api/routes";
import type { APIResponse, BlogEngagementSummary, BlogId } from "@/shared/contracts";

const QUALIFIED_VISIBLE_MS = 10_000;
const QUALIFIED_SCROLL_RATIO = 0.25;

export function ArticleEngagement({
  blogId,
  initialMemberViews,
  initialLikes,
}: {
  blogId: BlogId;
  initialMemberViews: number;
  initialLikes: number;
}) {
  const { session } = useAuth();
  const { activeAnchor, progressRatio, hasReaderMoved } = useReadingPosition();
  const { record, flush } = useBeacon();
  const [summary, setSummary] = useState<BlogEngagementSummary>({
    blog_id: blogId,
    member_view_count: initialMemberViews,
    like_count: initialLikes,
    liked_by_me: null,
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const recorded = useRef(false);
  const visitKey = useRef(newVisitKey());

  const qualify = useCallback(() => {
    if (recorded.current) return;
    recorded.current = true;
    record({
      blog_id: blogId,
      kind: "read",
      source: "direct",
      dedupe_key: `read:${visitKey.current}`,
    });
    flush();
  }, [blogId, flush, record]);

  useEffect(() => {
    if (hasReaderMoved && progressRatio >= QUALIFIED_SCROLL_RATIO) qualify();
  }, [activeAnchor, hasReaderMoved, progressRatio, qualify]);

  useEffect(() => {
    if (recorded.current) return;
    let visibleElapsed = 0;
    let visibleSince: number | null = null;
    let timer: number | undefined;

    const stop = () => {
      if (visibleSince !== null) {
        visibleElapsed += performance.now() - visibleSince;
        visibleSince = null;
      }
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const start = () => {
      if (
        recorded.current ||
        visibleSince !== null ||
        document.visibilityState !== "visible"
      )
        return;
      visibleSince = performance.now();
      timer = window.setTimeout(qualify, Math.max(0, QUALIFIED_VISIBLE_MS - visibleElapsed));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qualify]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${BFF_BASE}${routes.blogEngagement(blogId)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as APIResponse<BlogEngagementSummary>;
        if (!cancelled && payload.success && payload.data) setSummary(payload.data);
      })
      .catch(() => {
        // Initial server-provided counters remain usable when the live refresh
        // is unavailable; engagement must never take down the article.
      });
    return () => {
      cancelled = true;
    };
  }, [blogId, session.status]);

  const updateLike = async () => {
    if (session.status !== "authenticated") {
      setMessage("Sign in to like this article.");
      return;
    }
    const liked = summary.liked_by_me === true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`${BFF_BASE}${routes.blogLike(blogId)}`, {
        method: liked ? "DELETE" : "PUT",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json()) as APIResponse<BlogEngagementSummary>;
      if (!payload.success || !payload.data) throw new Error("like rejected");
      setSummary(payload.data);
      setMessage(liked ? "Like removed." : "Article liked.");
    } catch {
      setMessage("Your like could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-muted">
      <span>{formatCount(summary.member_view_count)} views</span>
      <button
        type="button"
        aria-pressed={summary.liked_by_me === true}
        disabled={pending || session.status === "loading"}
        onClick={() => void updateLike()}
        className="underline underline-offset-4 hover:text-fg disabled:cursor-wait disabled:opacity-60"
      >
        {summary.liked_by_me ? "Liked" : "Like"} · {formatCount(summary.like_count)}
      </button>
      {session.status === "anonymous" && (
        <Link href="/login" className="underline underline-offset-4 hover:text-fg">
          Sign in to like
        </Link>
      )}
      <span aria-live="polite">{message}</span>
    </div>
  );
}

function newVisitKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}
