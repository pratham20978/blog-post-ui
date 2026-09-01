import { cva } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Text input with its label and error wired together.
 *
 * `Field` owns the id, the `aria-describedby` link and `aria-invalid`, because
 * those three are what make an error announced rather than merely visible —
 * and they are exactly what gets forgotten when each screen wires its own
 * inputs.
 */

const input = cva(
  [
    "w-full h-11 px-3",
    "bg-bg text-fg placeholder:text-muted",
    "border rounded-control",
    "transition-colors duration-150",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      invalid: {
        true: "border-danger",
        false: "border-rule-strong hover:border-fg-subtle",
      },
    },
    defaultVariants: { invalid: false },
  },
);

export interface FieldProps extends Omit<ComponentPropsWithoutRef<"input">, "id"> {
  label: string;
  /** Rendered under the input, and announced. Presence sets `aria-invalid`. */
  error?: string | null;
  /** Static guidance, shown when there is no error. */
  hint?: ReactNode;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
}

export function Field({
  label,
  error,
  hint,
  hideLabel = false,
  className,
  ...props
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = Boolean(error);

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          "text-meta font-medium text-fg",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={cn(error && errorId, !error && hint && hintId) || undefined}
        className={cn(input({ invalid }), className)}
        {...props}
      />

      {error ? (
        // `role="alert"` so a validation failure arriving after submit is
        // announced without the user having to go looking for it.
        <p id={errorId} role="alert" className="text-meta text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-meta text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
