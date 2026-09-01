"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { THEME_STORAGE_KEY } from "./theme-script";

/** What the user chose. `system` follows the OS and keeps following it. */
export type ThemePreference = "light" | "dark" | "system";

/** What is actually on screen — `system` already resolved. */
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The stored preference, which is what a theme switcher should reflect. */
  theme: ThemePreference;
  /** The theme in effect. Use this to decide behaviour, never `theme`. */
  resolved: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The theme is external state — it lives in `localStorage`, in the OS setting,
 * and on the `<html>` element, all of which can change without React knowing.
 *
 * `useSyncExternalStore` is the tool built for exactly that. It subscribes to
 * both sources and gives the server a separate snapshot, which is what removes
 * the usual mount-effect-then-setState dance and its cascading render.
 */
const themeStore = {
  subscribe(onChange: () => void): () => void {
    const media = window.matchMedia(DARK_QUERY);

    // `storage` fires when another tab changes the preference, so two open
    // tabs stay in step.
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) onChange();
    };

    media.addEventListener("change", onChange);
    window.addEventListener("storage", onStorage);

    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  },

  /** The preference as stored. Read fresh each time; it is a single lookup. */
  getPreference(): ThemePreference {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {
      // Storage throws outright in some privacy modes.
    }
    // Light, not `system` — must stay in step with `theme-script.ts`, which
    // decides the first paint. If they disagree the switch starts out pointing
    // the wrong way.
    return "light";
  },

  getResolved(): ResolvedTheme {
    const preference = themeStore.getPreference();
    if (preference !== "system") return preference;
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  },

  /** The server has no viewer, so it renders the default and the client
   *  corrects on hydration — invisibly, because the head script already
   *  painted the right theme. */
  serverPreference: (): ThemePreference => "light",
  serverResolved: (): ResolvedTheme => "light",
};

function apply(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  // Drives native UI — scrollbars, form controls, the caret. Without it a dark
  // page keeps light scrollbars.
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getPreference,
    themeStore.serverPreference,
  );

  const resolved = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getResolved,
    themeStore.serverResolved,
  );

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Applies for this session; it just will not persist.
    }

    // Written to the DOM directly rather than through a render, because the
    // attribute is what the CSS reads. `subscribe` does not fire for our own
    // write, so nudge the store by dispatching the same event another tab
    // would have sent.
    apply(next === "system" ? themeStore.getResolved() : next);
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
  }, []);

  // Two-state toggle. Deliberately resolves `system` to its opposite rather
  // than cycling three ways — a switch that needs two clicks to visibly change
  // is a confusing switch.
  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
