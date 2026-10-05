import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ListDialog, type ListDialogStatus } from "./ListDialog";

beforeAll(() => {
  // jsdom implements <dialog> without its modal methods, and has no matchMedia.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia;
});

interface Item {
  readonly id: string;
  readonly title: string;
}

const ITEMS: readonly Item[] = Array.from({ length: 45 }, (_, index) => ({
  id: `item-${index}`,
  title: `Article ${index}`,
}));

/** Owns the query and filters, as every real caller does. */
function Harness({
  status = "ready",
  onClose = () => {},
  onRetry,
}: {
  status?: ListDialogStatus;
  onClose?: () => void;
  onRetry?: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  return (
    <ListDialog
      title="All articles"
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      searchLabel="Search all articles"
      status={status}
      items={ITEMS.filter((item) => item.title.toLowerCase().includes(needle))}
      getKey={(item) => item.id}
      renderItem={(item) => <a href={`#${item.id}`}>{item.title}</a>}
      noun={["article", "articles"]}
      emptyMessage="Nothing yet."
      onRetry={onRetry}
    />
  );
}

describe("ListDialog", () => {
  it("opens modally with the count, the first step of rows, and focus in the search box", () => {
    render(<Harness />);

    const dialog = screen.getByRole("dialog", { name: "All articles" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText("45 articles")).not.toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(20);
    expect(document.activeElement).toBe(
      screen.getByRole("searchbox", { name: "Search all articles" }),
    );
  });

  it("reveals the next step from its button and moves focus to the first new row", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Show more (25 more)" }));
    expect(screen.getAllByRole("link")).toHaveLength(40);
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Article 20" }));

    fireEvent.click(screen.getByRole("button", { name: "Show more (5 more)" }));
    expect(screen.getAllByRole("link")).toHaveLength(45);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("shows what the caller filtered and says when nothing matches", () => {
    render(<Harness />);
    const search = screen.getByRole("searchbox", { name: "Search all articles" });

    fireEvent.change(search, { target: { value: "Article 4" } });
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.getByText("6 results for “Article 4”")).not.toBeNull();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Nothing matches “zzz”.")).not.toBeNull();
  });

  it("closes through the dialog, so the parent can unmount it", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
  });

  it("shows loading, and an error with a retry", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Harness status="loading" />);
    expect(screen.getByRole("status").textContent).toContain("Loading");

    rerender(<Harness status="error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
