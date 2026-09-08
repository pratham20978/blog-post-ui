import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailPreferenceControl } from "./EmailPreferenceControl";

const initial = {
  user_id: "00000000-0000-7000-8000-000000000001",
  blog_announcements_enabled: true,
  updated_at: "2026-01-01T00:00:00Z",
};

function response(enabled: boolean): Response {
  return new Response(
    JSON.stringify({
      success: true,
      message: "OK",
      error: null,
      data: { ...initial, blog_announcements_enabled: enabled },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("EmailPreferenceControl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("supports disabling and re-enabling new-blog email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true)),
    );
    render(<EmailPreferenceControl initialPreference={initial} />);

    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    expect(await screen.findByRole("switch", { name: "Disabled" })).not.toBeNull();
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/me/email-preferences"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ blog_announcements_enabled: false }),
      }),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Disabled" }));
    expect(await screen.findByRole("switch", { name: "Enabled" })).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
