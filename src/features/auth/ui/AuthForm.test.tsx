import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.routerRefresh }),
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/providers/ConfigProvider", () => ({
  useConfig: () => ({
    oauthProviders: ["google", "github"],
    dataSource: "api",
    devOtpCode: null,
  }),
}));

import { AuthForm } from "./AuthForm";

const accepted = () =>
  new Response(
    JSON.stringify({
      success: true,
      message: "If that address can sign in, a code is on its way.",
      data: {
        expires_at: new Date(Date.now() + 600_000).toISOString(),
        resend_after: new Date(Date.now() - 1_000).toISOString(),
      },
      error: null,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const verified = () =>
  new Response(
    JSON.stringify({ success: true, message: "Signed in.", data: null, error: null }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

function submittedBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  const options = fetchMock.mock.calls[call]![1] as RequestInit;
  return JSON.parse(String(options.body));
}

describe("AuthForm OTP purpose", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.refresh.mockReset();
    mocks.push.mockReset();
    mocks.routerRefresh.mockReset();
  });

  it.each(["login", "signup"] as const)(
    "carries %s through request, verification, and the code-screen copy",
    async (purpose) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(accepted())
        .mockResolvedValueOnce(verified());
      vi.stubGlobal("fetch", fetchMock);
      render(<AuthForm purpose={purpose} />);

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "reader@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));

      expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
      expect(
        screen.getByText(
          new RegExp(`six-digit ${purpose === "signup" ? "signup" : "sign-in"} code`),
        ),
      ).toBeTruthy();
      expect(submittedBody(fetchMock, 0)).toEqual({
        email: "reader@example.com",
        purpose,
      });

      fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
        target: { value: "123456" },
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(submittedBody(fetchMock, 1)).toEqual({
        email: "reader@example.com",
        code: "123456",
        purpose,
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
      expect(mocks.push).toHaveBeenCalledWith("/blogs");
    },
  );

  it("keeps the user on the email step when Resend rejects delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: "The message could not be sent. Try again shortly.",
          data: null,
          error: {
            category: "EMAIL_SEND_FAILED",
            safe_message: "The message could not be sent. Try again shortly.",
          },
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm purpose="signup" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));

    expect(
      await screen.findByText("The message could not be sent. Try again shortly."),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Check your email" })).toBeNull();
  });

  it("retains signup purpose when resending", async () => {
    const fetchMock = vi.fn().mockResolvedValue(accepted());
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm purpose="signup" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    await screen.findByRole("heading", { name: "Check your email" });

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Resend code" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(submittedBody(fetchMock, 1)).toEqual({
      email: "reader@example.com",
      purpose: "signup",
    });
  });
});

describe("AuthForm OAuth discovery", () => {
  it.each(["login", "signup"] as const)(
    "shows every enabled provider on the %s form",
    (purpose) => {
      const view = render(<AuthForm purpose={purpose} />);

      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeTruthy();
      view.unmount();
    },
  );
});
