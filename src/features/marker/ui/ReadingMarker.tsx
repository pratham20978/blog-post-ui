"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useReadingPosition } from "@/features/marker/model/ReadingPositionProvider";
import { BFF_BASE, routes } from "@/shared/api/routes";
import type { APIResponse, BlogId, Marker, MarkerBody } from "@/shared/contracts";

const SAVE_IDLE_MS = 2_000;
const SAVE_INTERVAL_MS = 10_000;
const MIN_PROGRESS = 0.02;
const COMPLETE_PROGRESS = 0.95;

export function ReadingMarker({ blogId }: { blogId: BlogId }) {
  const { session } = useAuth();
  const { activeAnchor, progressRatio, hasReaderMoved } = useReadingPosition();
  const [marker, setMarker] = useState<Marker | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const latest = useRef({ activeAnchor, progressRatio });
  const lastSavedAt = useRef(0);
  const lastPersistedPosition = useRef<string | null>(null);
  const userId = session.status === "authenticated" ? session.user.id : null;
  const loaded = userId === null || loadedFor === userId;

  useEffect(() => {
    latest.current = { activeAnchor, progressRatio };
  }, [activeAnchor, progressRatio]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const owner = userId;
    void fetch(`${BFF_BASE}${routes.marker(blogId)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as APIResponse<Marker>;
        if (!cancelled) {
          const loadedMarker = body.success && body.data ? body.data : null;
          setMarker(loadedMarker);
          lastPersistedPosition.current = markerPositionKey(loadedMarker);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarker(null);
          setMessage("Your saved position could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedFor(owner);
      });
    return () => {
      cancelled = true;
    };
  }, [blogId, userId]);

  const save = useCallback(
    async (position = latest.current, keepalive = false): Promise<void> => {
      if (session.status !== "authenticated") return;
      const body = markerBody(position.activeAnchor, position.progressRatio);
      if (!body) {
        if (!keepalive) setMessage("Scroll to a section before saving your position.");
        return;
      }
      try {
        const response = await fetch(`${BFF_BASE}${routes.marker(blogId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          keepalive,
        });
        const payload = (await response.json()) as APIResponse<Marker>;
        if (!payload.success || !payload.data) throw new Error("marker rejected");
        setMarker(payload.data);
        lastPersistedPosition.current = positionKey(
          position.activeAnchor,
          position.progressRatio,
        );
        lastSavedAt.current = Date.now();
        setMessage("Reading position saved.");
      } catch {
        if (!keepalive) setMessage("Your reading position could not be saved.");
      }
    },
    [blogId, session.status],
  );

  const clear = useCallback(
    async (completed = false): Promise<void> => {
      if (session.status !== "authenticated") return;
      try {
        const response = await fetch(`${BFF_BASE}${routes.marker(blogId)}`, {
          method: "DELETE",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("marker delete rejected");
        setMarker(null);
        lastPersistedPosition.current = positionKey(
          latest.current.activeAnchor,
          latest.current.progressRatio,
        );
        setMessage(completed ? "Article completed." : "Saved position cleared.");
      } catch {
        setMessage("Your saved position could not be cleared.");
      }
    },
    [blogId, session.status],
  );

  useEffect(() => {
    if (
      session.status !== "authenticated" ||
      !loaded ||
      !hasReaderMoved ||
      progressRatio < MIN_PROGRESS
    ) {
      return;
    }
    if (progressRatio >= COMPLETE_PROGRESS) {
      if (!marker) return;
      const completionTimer = window.setTimeout(() => void clear(true), 0);
      return () => window.clearTimeout(completionTimer);
    }
    if (
      lastPersistedPosition.current === positionKey(activeAnchor, progressRatio)
    ) {
      return;
    }

    const sinceLastSave = Date.now() - lastSavedAt.current;
    const delay = Math.max(SAVE_IDLE_MS, SAVE_INTERVAL_MS - sinceLastSave);
    const timer = window.setTimeout(() => {
      void save({ activeAnchor, progressRatio });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    activeAnchor,
    clear,
    hasReaderMoved,
    loaded,
    marker,
    progressRatio,
    save,
    session.status,
  ]);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    const flush = (event: Event) => {
      const position = latest.current;
      if (
        (event.type === "pagehide" || document.visibilityState === "hidden") &&
        hasReaderMoved &&
        position.progressRatio >= MIN_PROGRESS &&
        position.progressRatio < COMPLETE_PROGRESS &&
        lastPersistedPosition.current !==
          positionKey(position.activeAnchor, position.progressRatio)
      ) {
        void save(position, true);
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [hasReaderMoved, save, session.status]);

  if (session.status === "loading" || !loaded) {
    return <p className="mt-5 text-meta text-muted">Restoring reading position…</p>;
  }

  if (session.status !== "authenticated") {
    return (
      <p className="mt-5 text-meta text-muted">
        <Link href="/login" className="underline underline-offset-4 hover:text-fg">
          Sign in
        </Link>{" "}
        to save your reading position.
      </p>
    );
  }

  const resumeAnchor = marker?.anchor.kind === "section" ? marker.anchor.anchor : null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta">
      {resumeAnchor && (
        <button
          type="button"
          className="underline underline-offset-4 hover:text-muted"
          onClick={() => document.getElementById(resumeAnchor)?.scrollIntoView()}
        >
          Resume at {resumeAnchor.replaceAll("-", " ")}
        </button>
      )}
      <button
        type="button"
        className="underline underline-offset-4 hover:text-muted"
        onClick={() => void save()}
      >
        Save current position
      </button>
      {marker && (
        <button
          type="button"
          className="underline underline-offset-4 hover:text-muted"
          onClick={() => void clear()}
        >
          Clear saved position
        </button>
      )}
      <span aria-live="polite" className="text-muted">
        {message}
      </span>
    </div>
  );
}

export function markerBody(
  activeAnchor: string | null,
  progressRatio: number,
): MarkerBody | null {
  return activeAnchor
    ? {
        anchor: { kind: "section", anchor: activeAnchor, offset_in_section: 0 },
        progress_ratio: progressRatio,
      }
    : null;
}

function positionKey(activeAnchor: string | null, progressRatio: number): string | null {
  return activeAnchor ? `${activeAnchor}:${progressRatio.toFixed(4)}` : null;
}

function markerPositionKey(marker: Marker | null): string | null {
  return marker?.anchor.kind === "section" && marker.progress_ratio !== null
    ? positionKey(marker.anchor.anchor, marker.progress_ratio)
    : null;
}
