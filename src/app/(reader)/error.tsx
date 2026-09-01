"use client";

import { useEffect } from "react";

import { correlationIdOf, isNetworkError, messageFor } from "@/shared/api/errors";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { Container, Eyebrow } from "@/shared/ui/primitives";

/**
 * Failures inside the reading shell.
 *
 * Placed in this segment rather than only at the app root so the header,
 * footer and theme survive: a reader who hits a broken article can still
 * navigate, search, and reach anything else on the site. Replacing the whole
 * document with an apology strands them.
 */
export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Reader route error", error);
  }, [error]);

  // A transport failure and a rejected request need different words: one is
  // "come back shortly", the other is "this will not work".
  const offline = isNetworkError(error);

  // Next replaces a server error's message with an opaque digest before it
  // reaches the browser, so the API's correlation id is only present for
  // errors thrown client-side. Either identifier is enough to find the
  // request in the logs.
  const reference = correlationIdOf(error) ?? error.digest;

  // `messageFor` falls back to a generic line for an error it cannot read —
  // which is every server-thrown one, by design. Repeating it under a heading
  // that already says the same thing tells the reader nothing, so the generic
  // case gets sentences that are actually useful instead.
  const detail = messageFor(error);
  const body =
    detail === "Something went wrong."
      ? "The problem is on our side, not with the link you followed. Trying again often works."
      : detail;

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <Eyebrow>{offline ? "Cannot reach the server" : "Something went wrong"}</Eyebrow>

      <h1 className="mt-4 text-title font-semibold tracking-title">
        {offline ? "This page is temporarily unavailable" : "This page could not be loaded"}
      </h1>

      <p className="mt-4 max-w-md text-[0.9375rem] text-muted">
        {offline
          ? "We could not reach the server. Check your connection, or try again in a moment."
          : body}
      </p>

      {reference && (
        <p className="mt-4 font-mono text-meta text-muted">Reference: {reference}</p>
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
