"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/shared/lib/cn";

const LENGTH = 6;

/**
 * Six-box code entry.
 *
 * The value is owned by the parent as a single string; the boxes are a
 * presentation of it. Keeping six separate pieces of state in sync with each
 * other is where this control usually goes wrong — paste, backspace and
 * autofill all have to agree.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  label = "Verification code",
}: {
  value: string;
  onChange: (next: string) => void;
  /** Fires once all six digits are present, so the user need not press submit. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    return clean;
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    // Typing into a box replaces from that position onward, so overtyping a
    // wrong digit behaves the way it looks like it should.
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(
      0,
      LENGTH,
    );
    const committed = commit(next);

    const focus = Math.min(index + digits.length, LENGTH - 1);
    if (committed.length < LENGTH) inputs.current[focus]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();

      if (value[index]) {
        // Clear this box and stay put.
        commit(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        // Already empty — step back and clear that one, which is what
        // repeated backspace should do.
        commit(value.slice(0, index - 1) + value.slice(index));
        inputs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };

  // A code pasted from an email arrives in one box; without this it would fill
  // a single digit and drop the rest.
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;

    const committed = commit(pasted);
    inputs.current[Math.min(committed.length, LENGTH - 1)]?.focus();
  };

  return (
    <fieldset disabled={disabled} className="border-0 p-0">
      <legend className="sr-only">{label}</legend>

      <div className="flex gap-2 sm:gap-3">
        {Array.from({ length: LENGTH }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            // `text` with a numeric inputMode, not `number`: a number input
            // shows spinners and lets you type "e" and "-".
            type="text"
            inputMode="numeric"
            // Lets the browser and iOS offer the code straight from the SMS or
            // email it just saw.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            value={value[index] ?? ""}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            className={cn(
              "h-14 w-full min-w-0 rounded-control border text-center",
              "font-mono text-[1.25rem] tabular-nums",
              "transition-colors disabled:opacity-40",
              invalid ? "border-danger" : "border-rule-strong hover:border-fg-subtle",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
