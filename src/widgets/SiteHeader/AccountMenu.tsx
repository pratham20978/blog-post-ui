"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { Avatar } from "@/shared/ui/primitives";

/**
 * The right-hand side of the header: an avatar menu when signed in, a sign-in
 * link when not.
 *
 * Because `AuthProvider` is seeded on the server, the correct branch renders on
 * the first paint — no flicker from "Sign in" to an avatar on every page load.
 */
export function AccountMenu() {
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Escape must return focus to what opened the menu, or the keyboard user
      // is dropped back at the top of the document.
      trigger.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (session.status !== "authenticated") {
    return (
      <Link
        href="/login"
        className="inline-flex h-10 items-center px-3 text-[0.9375rem] font-medium text-fg transition-colors hover:text-muted"
      >
        Sign in
      </Link>
    );
  }

  const { user } = session;
  const name = user.display_name ?? user.email;

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar name={user.display_name} email={user.email} size={30} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-60 border border-rule bg-bg py-1 shadow-sm"
        >
          <div className="border-b border-rule px-4 py-3">
            <p className="truncate text-[0.9375rem] font-medium text-fg">{name}</p>
            {user.display_name && (
              <p className="truncate text-meta text-muted">{user.email}</p>
            )}
          </div>

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-[0.9375rem] text-fg transition-colors hover:bg-surface-hover"
          >
            Profile
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="block w-full px-4 py-2.5 text-left text-[0.9375rem] text-fg transition-colors hover:bg-surface-hover"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
