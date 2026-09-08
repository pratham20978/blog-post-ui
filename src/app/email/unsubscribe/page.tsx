import type { Metadata } from "next";

import { UnsubscribeForm } from "@/features/announcement/ui/UnsubscribeForm";
import { Container, Eyebrow } from "@/shared/ui/primitives";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg border border-rule p-7 sm:p-10">
        <Eyebrow>Email preferences</Eyebrow>
        <h1 className="mt-3 text-title font-semibold tracking-title">
          Unsubscribe from new-blog emails
        </h1>
        <div className="mt-5">
          {token.length >= 20 ? (
            <UnsubscribeForm token={token} />
          ) : (
            <p className="text-[0.9375rem] text-muted">This unsubscribe link is invalid.</p>
          )}
        </div>
      </div>
    </Container>
  );
}
