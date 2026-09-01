import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones in
 * the same group. Without `twMerge`, a `className` prop passed by a caller
 * loses to the component's own defaults, and variant overrides silently do
 * nothing.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
