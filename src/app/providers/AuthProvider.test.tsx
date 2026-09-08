import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

vi.mock("./ConfigProvider", () => ({
  useConfig: () => ({ dataSource: "api" }),
}));

import { AuthProvider, useSession } from "./AuthProvider";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function envelope(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: status < 400,
      message: status < 400 ? "OK" : "Failed",
      data: status < 400 ? data : null,
      error:
        status < 400
          ? null
          : {
              category: status >= 500 ? "INTERNAL_ERROR" : "REFRESH_TOKEN_INVALID",
              safe_message: "Session unavailable.",
            },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

const user = {
  id: "user-1",
  email: "reader@example.com",
  display_name: "Reader",
  is_admin: false,
  status: "active",
  email_verified_at: "2026-09-08T12:00:00Z",
  created_at: "2026-09-08T12:00:00Z",
  updated_at: "2026-09-08T12:00:00Z",
};

function SessionStatus() {
  const session = useSession();
  return <span>{session.status}</span>;
}

describe("AuthProvider restoration", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.routerRefresh.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays neutral on a transient refresh failure", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(envelope(null, 503));

    render(
      <AuthProvider initialSession={{ status: "loading" }}>
        <SessionStatus />
      </AuthProvider>,
    );

    await act(async () => {
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    });
    expect(screen.getByText("loading")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueries).toHaveBeenCalled();
  });

  it("restores the user through the BFF and refreshes Server Components", async () => {
    fetchMock.mockResolvedValueOnce(envelope(user));

    render(
      <AuthProvider initialSession={{ status: "loading" }}>
        <SessionStatus />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("authenticated")).toBeTruthy());
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows logged-out state after a definitive refresh rejection", async () => {
    fetchMock.mockResolvedValueOnce(envelope(null, 401));

    render(
      <AuthProvider initialSession={{ status: "loading" }}>
        <SessionStatus />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("anonymous")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.routerRefresh).not.toHaveBeenCalled();
  });
});
