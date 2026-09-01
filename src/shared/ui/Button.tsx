import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * The one button in the system. `Button` renders a `<button>`, `ButtonLink`
 * renders an `<a>` with identical styling — never a `<button>` wrapped in a
 * link or an `onClick` on an anchor, both of which break keyboard and
 * middle-click behaviour.
 */
const button = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium tracking-ui whitespace-nowrap",
    "rounded-control",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    // 44px minimum target on the default size, per the a11y baseline.
    "min-h-11",
  ],
  {
    variants: {
      variant: {
        /** The single primary action on a screen. */
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        /** Everything alongside it. */
        secondary: "border border-rule-strong text-fg hover:bg-surface-hover",
        /** Low-emphasis, in dense rows and toolbars. */
        ghost: "text-fg hover:bg-surface-hover",
        /** Reads as body text, behaves as a control. */
        link: "text-fg underline underline-offset-4 decoration-rule-strong hover:decoration-fg min-h-0",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 min-h-9 px-3 text-meta",
        md: "h-11 px-5 text-[0.9375rem]",
        lg: "h-12 px-7 text-base",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonVariants = VariantProps<typeof button>;

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "color">,
    ButtonVariants {
  children: ReactNode;
}

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size, block }), className)} {...props} />;
}

export interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "color">,
    ButtonVariants {
  children: ReactNode;
}

export function ButtonLink({ className, variant, size, block, ...props }: ButtonLinkProps) {
  return <Link className={cn(button({ variant, size, block }), className)} {...props} />;
}
