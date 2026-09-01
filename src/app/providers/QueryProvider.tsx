"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { shouldRetry } from "@/shared/api/errors";

/**
 * Owns the TanStack QueryClient.
 *
 * The client is created inside `useState` rather than at module scope. A
 * module-level client would be shared across every request on the server,
 * leaking one user's cached `/me` data into another's render — the classic
 * SSR cache-poisoning bug. This way each request gets its own, and the browser
 * keeps one for the session.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Matches the `Cache-Control: public, max-age=60` the backend sets on
        // article content. Refetching sooner than the server considers the
        // data stale is pure waste.
        staleTime: 60_000,
        gcTime: 5 * 60_000,

        // Only retry what the server said was retryable. Blind retries here
        // would repeat 404s and validation failures, and — worse — could
        // replay a request whose 401 is about to trigger a token refresh.
        retry: (failureCount, error) => failureCount < 2 && shouldRetry(error),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),

        // The feed and article pages are server-rendered and rarely change
        // under the reader; refetching every time the window regains focus is
        // noise on a publication.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // A mutation that failed has usually already had an effect decided by
        // the server. Retrying is how you get two comments.
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
