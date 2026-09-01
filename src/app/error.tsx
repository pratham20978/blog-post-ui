"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/shared/ui/Button";
import { Container, Eyebrow } from "@/shared/ui/primitives";

/**
 * The route-level error boundary.
 *
 * `digest` is the only identifier available here: Next replaces a server
 * error's message with an opaque hash before it reaches the browser, so a
 * correlation id from the API is not visible at this layer. Showing the digest
 * is still what lets a report be matched to a server log line.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <Eyebrow>Something went wrong</Eyebrow>
      <h1 className="mt-4 text-title font-semibold tracking-title">
        This page could not be loaded
      </h1>
      <p className="mt-4 max-w-md text-[0.9375rem] text-muted">
        The problem is on our side. Trying again often works.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-meta text-muted">Reference: {error.digest}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/blogs" variant="secondary">
          Back to articles
        </ButtonLink>
      </div>
    </Container>
  );
}
