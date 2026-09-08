"use client";

import { useState } from "react";

import { BFF_BASE, routes } from "@/shared/api/routes";
import type { APIResponse, BlogEmailPreference } from "@/shared/contracts";

export function EmailPreferenceControl({
  initialPreference,
}: {
  initialPreference: BlogEmailPreference;
}) {
  const [preference, setPreference] = useState(initialPreference);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const update = async (enabled: boolean) => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`${BFF_BASE}${routes.emailPreferences()}`, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ blog_announcements_enabled: enabled }),
        cache: "no-store",
      });
      const payload = (await response.json()) as APIResponse<BlogEmailPreference>;
      if (!payload.success || !payload.data) throw new Error("preference rejected");
      setPreference(payload.data);
      setMessage(enabled ? "New-blog emails enabled." : "New-blog emails disabled.");
    } catch {
      setMessage("Your email preference could not be updated.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-[0.9375rem] text-muted">
        Receive a message when Canery publishes a new article.
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={preference.blog_announcements_enabled}
        disabled={pending}
        onClick={() => void update(!preference.blog_announcements_enabled)}
        className="border border-rule px-4 py-2 text-meta hover:border-fg disabled:cursor-wait disabled:opacity-60"
      >
        {preference.blog_announcements_enabled ? "Enabled" : "Disabled"}
      </button>
      <span aria-live="polite" className="text-meta text-muted">
        {message}
      </span>
    </div>
  );
}
