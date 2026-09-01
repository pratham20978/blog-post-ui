"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { BFF_BASE, routes } from "@/shared/api/routes";
import type { RecordEngagementCommand } from "@/shared/contracts";

/**
 * The engagement beacon queue.
 *
 * A provider rather than a hook because the queue has to outlive any single
 * component: dwell time accumulates across a route change, and the flush that
 * matters most happens as the tab is closing, when the component that recorded
 * the event is already gone.
 *
 * Events are queued and flushed in a batch on `visibilitychange`, because the
 * backend accepts one event per request and firing each immediately would mean
 * a request per card scrolled past.
 */
interface EngagementContextValue {
  /** Queue an event. Never throws and never blocks — telemetry must not be
   *  able to break a reader's page. */
  record: (command: RecordEngagementCommand) => void;
  /** Send everything queued now. */
  flush: () => void;
}

const EngagementContext = createContext<EngagementContextValue | null>(null);

/** Backstop flush so a long reading session does not sit on a large queue. */
const FLUSH_INTERVAL_MS = 30_000;

/** Well below any practical limit; a queue longer than this means something is
 *  recording in a loop, and dropping is better than a runaway. */
const MAX_QUEUE = 50;

function newDedupeKey(): string {
  // The server namespaces this per actor, so it only has to be unique for one
  // visitor. `randomUUID` needs a secure context and is absent in a few
  // embedded browsers, hence the fallback.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function EngagementProvider({ children }: { children: ReactNode }) {
  const queue = useRef<RecordEngagementCommand[]>([]);

  const flush = useCallback(() => {
    const pending = queue.current;
    if (pending.length === 0) return;
    queue.current = [];

    const url = `${BFF_BASE}${routes.engagement()}`;

    for (const command of pending) {
      const payload = JSON.stringify(command);

      // `sendBeacon` is the only transport the browser guarantees to complete
      // after the page goes away, which is exactly when dwell and completion
      // are recorded. It cannot set headers, so the content type rides on the
      // Blob; cookies are sent because the request is same-origin, which is
      // what lets the BFF attach the caller's tokens.
      const sent =
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));

      if (!sent) {
        // Older browsers, or a beacon the browser refused (queue full).
        // `keepalive` gives the same survive-unload property for small bodies.
        void fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {
          // Telemetry is best-effort by design. The log is at-least-once and
          // deduplicated server-side; a dropped beacon is an accepted loss and
          // must never surface to the reader.
        });
      }
    }
  }, []);

  const record = useCallback((command: RecordEngagementCommand) => {
    if (queue.current.length >= MAX_QUEUE) return;
    queue.current.push({
      ...command,
      dedupe_key: command.dedupe_key ?? newDedupeKey(),
    });
  }, []);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };

    // `visibilitychange` is the reliable signal on mobile, where a backgrounded
    // tab is often killed without ever firing `pagehide` or `unload`.
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      clearInterval(timer);
      // Anything still queued when the tree unmounts.
      flush();
    };
  }, [flush]);

  const value = useMemo(() => ({ record, flush }), [record, flush]);

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useBeacon(): EngagementContextValue {
  const context = useContext(EngagementContext);
  if (!context) throw new Error("useBeacon must be used inside <EngagementProvider>");
  return context;
}
