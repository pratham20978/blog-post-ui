import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Marker } from "@/shared/contracts";

const state = vi.hoisted(() => ({
  session: { status: "anonymous", actorId: null } as Record<string, unknown>,
  position: {
    activeAnchor: "worked-example",
    progressRatio: 0.42,
    hasReaderMoved: false,
  },
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ session: state.session }),
}));

vi.mock("@/features/marker/model/ReadingPositionProvider", () => ({
  useReadingPosition: () => state.position,
}));

import { markerBody, ReadingMarker } from "./ReadingMarker";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const marker: Marker = {
  user_id: "user-1",
  blog_id: "blog-1",
  anchor: { kind: "section", anchor: "worked-example", offset_in_section: 0 },
  progress_ratio: 0.42,
  updated_at: "2026-09-08T12:00:00Z",
};

function response(data: Marker | null, status = 200): Response {
  return new Response(
    JSON.stringify({ success: true, message: "OK", data, error: null }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("ReadingMarker", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    state.session = { status: "anonymous", actorId: null };
    state.position = {
      activeAnchor: "worked-example",
      progressRatio: 0.42,
      hasReaderMoved: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById("worked-example")?.remove();
  });

  it("writes section anchors with a zero section offset", () => {
    expect(markerBody("worked-example", 0.42)).toEqual({
      anchor: { kind: "section", anchor: "worked-example", offset_in_section: 0 },
      progress_ratio: 0.42,
    });
    expect(markerBody(null, 0.42)).toBeNull();
  });

  it("offers anonymous readers an unobtrusive sign-in action", () => {
    render(<ReadingMarker blogId="blog-1" />);

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a marker and supports manual save and clear", async () => {
    state.session = { status: "authenticated", user: { id: "user-1" } };
    fetchMock
      .mockResolvedValueOnce(response(marker))
      .mockResolvedValueOnce(response(marker))
      .mockResolvedValueOnce(response(null));

    render(<ReadingMarker blogId="blog-1" />);

    const resume = await screen.findByRole("button", {
      name: "Resume at worked example",
    });
    const target = document.createElement("div");
    target.id = "worked-example";
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    fireEvent.click(resume);
    expect(target.scrollIntoView).toHaveBeenCalled();

    const saveButton = screen.getByRole("button", { name: "Save current position" });
    saveButton.focus();
    expect(document.activeElement).toBe(saveButton);
    expect(saveButton.tagName).toBe("BUTTON");
    fireEvent.click(saveButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const save = fetchMock.mock.calls[1];
    expect(save?.[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(save?.[1]?.body))).toEqual(markerBody("worked-example", 0.42));

    fireEvent.click(screen.getByRole("button", { name: "Clear saved position" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("announces save failures without removing the controls", async () => {
    state.session = { status: "authenticated", user: { id: "user-1" } };
    fetchMock
      .mockResolvedValueOnce(response(null))
      .mockRejectedValueOnce(new Error("offline"));

    render(<ReadingMarker blogId="blog-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Save current position" }));

    const status = await screen.findByText("Your reading position could not be saved.");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("button", { name: "Save current position" })).toBeTruthy();
  });

  it("flushes the current section with keepalive on page hide", async () => {
    state.session = { status: "authenticated", user: { id: "user-1" } };
    state.position.hasReaderMoved = true;
    fetchMock.mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response(marker));

    render(<ReadingMarker blogId="blog-1" />);
    await screen.findByRole("button", { name: "Save current position" });
    fireEvent(window, new Event("pagehide"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PUT", keepalive: true });
  });

  it("debounces idle saves and never writes more than once in ten seconds", async () => {
    vi.useFakeTimers();
    state.session = { status: "authenticated", user: { id: "user-1" } };
    state.position.hasReaderMoved = true;
    fetchMock
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(marker))
      .mockResolvedValueOnce(response(marker));

    const view = render(<ReadingMarker blogId="blog-1" />);
    await act(async () => {
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    state.position = { ...state.position, progressRatio: 0.5 };
    view.rerender(<ReadingMarker blogId="blog-1" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears an existing marker when progress reaches 95 percent", async () => {
    state.session = { status: "authenticated", user: { id: "user-1" } };
    state.position = {
      activeAnchor: "conclusion",
      progressRatio: 0.95,
      hasReaderMoved: true,
    };
    fetchMock.mockResolvedValueOnce(response(marker)).mockResolvedValueOnce(response(null));

    render(<ReadingMarker blogId="blog-1" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
