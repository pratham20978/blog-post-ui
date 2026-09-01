import Link from "next/link";

import { ButtonLink } from "@/shared/ui/Button";
import { Container, Eyebrow } from "@/shared/ui/primitives";

/**
 * The 404. Offers a way onward rather than dead-ending — the most common way
 * to land here is a stale link to an article that was archived.
 */
export default function NotFound() {
  return (
    <Container className="flex min-h-dvh flex-col items-center justify-center py-24 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-4 text-display font-semibold leading-display tracking-display">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-[0.9375rem] text-muted">
        The page you are looking for does not exist, or is no longer published.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href="/blogs">Browse articles</ButtonLink>
        <Link href="/series" className="text-[0.9375rem] underline underline-offset-4">
          View series
        </Link>
      </div>
    </Container>
  );
}
