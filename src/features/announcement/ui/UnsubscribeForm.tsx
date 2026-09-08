"use client";

import Link from "next/link";
import { useState } from "react";

export function UnsubscribeForm({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

  if (status === "done") {
    return (
      <div aria-live="polite">
        <p className="text-[0.9375rem] text-muted">
          You will no longer receive new-blog emails from Canery.
        </p>
        <Link href="/profile" className="mt-5 inline-block underline underline-offset-4">
          Manage email preferences
        </Link>
      </div>
    );
  }

  const unsubscribe = async () => {
    setStatus("pending");
    try {
      const response = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
        cache: "no-store",
      });
      setStatus(response.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div>
      <p className="text-[0.9375rem] text-muted">
        Stop emails that announce newly published Canery articles. Account and sign-in
        emails are unaffected.
      </p>
      <button
        type="button"
        disabled={status === "pending" || token.length < 20}
        onClick={() => void unsubscribe()}
        className="mt-6 border border-fg bg-fg px-5 py-3 text-sm text-bg disabled:cursor-wait disabled:opacity-60"
      >
        {status === "pending" ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      <p aria-live="polite" className="mt-4 text-meta text-muted">
        {status === "error" ? "This link could not be processed. Please try again." : ""}
      </p>
    </div>
  );
}
