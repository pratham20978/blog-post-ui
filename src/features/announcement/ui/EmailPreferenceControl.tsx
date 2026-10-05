"use client";

import { useId, useState } from "react";

import { BFF_BASE, routes } from "@/shared/api/routes";
import type { APIResponse, BlogEmailPreference } from "@/shared/contracts";
import { cn } from "@/shared/lib/cn";

/**
 * The new-article email setting, as an on/off switch.
 *
 * On for every account unless the reader turned it off here or through an
 * unsubscribe link (the column defaults to true). The switch shows its state,
 * and its accessible name is the setting rather than the state, so a screen
 * reader announces "Email me when a new article is published, switch, on".
 */
export function EmailPreferenceControl({
  initialPreference,
}: {
  initialPreference: BlogEmailPreference;
}) {
  const labelId = useId();
  const [preference, setPreference] = useState(initialPreference);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const enabled = preference.blog_announcements_enabled;

  const update = async (next: boolean) => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`${BFF_BASE}${routes.emailPreferences()}`, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ blog_announcements_enabled: next }),
        cache: "no-store",
      });
      const payload = (await response.json()) as APIResponse<BlogEmailPreference>;
      if (!payload.success || !payload.data) throw new Error("preference rejected");
      setPreference(payload.data);
      setMessage(next ? "New-blog emails enabled." : "New-blog emails disabled.");
    } catch {
      setMessage("Your email preference could not be updated.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-6">
        <p id={labelId} className="text-[0.9375rem] text-fg">
          Email me when a new article is published
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby={labelId}
          disabled={pending}
          onClick={() => void update(!enabled)}
          className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-control px-1 disabled:cursor-wait disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative h-6 w-11 rounded-full border transition-colors",
              enabled ? "border-fg bg-fg" : "border-rule-strong bg-surface-hover",
            )}
          >
            {/* Anchored with an explicit `left`: left to its static position,
                an absolute box inherits the button's centred text-align and
                starts from the middle of the track. */}
            <span
              className={cn(
                "absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full transition-transform",
                enabled ? "translate-x-5 bg-bg" : "translate-x-0 bg-muted",
              )}
            />
          </span>
          {/* The state is announced through aria-checked; this is for the eye. */}
          <span aria-hidden="true" className="w-7 text-left text-meta text-fg">
            {enabled ? "On" : "Off"}
          </span>
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-meta text-muted">
        {message}
      </p>
    </div>
  );
}
