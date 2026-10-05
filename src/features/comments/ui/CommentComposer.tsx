"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/Button";

/** The API's ceiling on a comment body. */
const MAX_LENGTH = 10_000;
/** The counter appears only once it starts to matter. */
const COUNTER_FROM = 9_000;

/**
 * The one comment form: a new comment, a reply, and an edit.
 *
 * It owns only the text. Saving is the caller's — `onSubmit` resolves when the
 * write succeeded and rejects when it did not, and the caller says why through
 * `error` — so a failed post keeps everything the reader wrote.
 */
export function CommentComposer({
  label,
  submitLabel,
  placeholder,
  initialValue = "",
  hint,
  pending,
  error,
  onSubmit,
  onCancel,
  clearOnSuccess = false,
  autoFocus = false,
}: {
  /** The textarea's accessible name. */
  label: string;
  submitLabel: string;
  placeholder?: string;
  initialValue?: string;
  /** Shown under the box, e.g. who the comment will be posted as. */
  hint?: ReactNode;
  pending: boolean;
  error: string | null;
  onSubmit: (body: string) => Promise<unknown>;
  onCancel?: () => void;
  clearOnSuccess?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [value, setValue] = useState(initialValue);

  const body = value.trim();
  const ready = body !== "" && body !== initialValue.trim() && !pending;

  const submit = async () => {
    if (!ready) return;
    try {
      await onSubmit(body);
      if (clearOnSuccess) setValue("");
    } catch {
      // Reported through `error`; the text stays put so nothing is lost.
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        rows={3}
        maxLength={MAX_LENGTH}
        // Read-only rather than disabled while saving, so focus stays in the box.
        readOnly={pending}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        // Grows with its text where the browser supports it; a resizable box
        // where it does not. 16px, so iOS does not zoom the page on focus.
        className="field-sizing-content min-h-24 max-h-96 w-full resize-y rounded-control border border-rule-strong bg-bg px-3 py-2 text-base leading-relaxed text-fg transition-colors placeholder:text-muted hover:border-fg-subtle"
      />

      {error && (
        <p id={errorId} role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-muted">
          {value.length >= COUNTER_FROM
            ? `${value.length.toLocaleString("en")} / ${MAX_LENGTH.toLocaleString("en")}`
            : hint}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!ready}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
