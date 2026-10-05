import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("is a switch named for the setting, with its state in aria-checked", () => {
    render(<EmailPreferenceControl initialPreference={initial} />);

    const toggle = screen.getByRole("switch", { name: "Email me when a new article is published" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("supports disabling and re-enabling new-blog email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true)),
    );
    render(<EmailPreferenceControl initialPreference={initial} />);
    const toggle = screen.getByRole("switch", { name: "Email me when a new article is published" });

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/me/email-preferences"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ blog_announcements_enabled: false }),
      }),
    );
    expect(screen.getByText("New-blog emails disabled.")).not.toBeNull();

    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the current state and says so when the update fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));
    render(<EmailPreferenceControl initialPreference={initial} />);
    const toggle = screen.getByRole("switch", { name: "Email me when a new article is published" });

    fireEvent.click(toggle);
    expect(await screen.findByText("Your email preference could not be updated.")).not.toBeNull();
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });
});
