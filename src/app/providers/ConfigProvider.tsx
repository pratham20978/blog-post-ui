"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AppConfig } from "@/shared/config";

/**
 * Carries server-read configuration to client components.
 *
 * The value is read once in a Server Component (`readServerConfig`) and passed
 * down as a prop. Client code never touches `process.env`: that keeps every
 * environment lookup in one auditable place, makes config a plain object in
 * tests, and means a new flag cannot accidentally be read somewhere it would
 * be `undefined` in the browser.
 */
const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({
  config,
  children,
}: {
  config: AppConfig;
  children: ReactNode;
}) {
  // No `useMemo`: `config` is created once per request on the server and is
  // referentially stable for the life of the tree.
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig(): AppConfig {
  const context = useContext(ConfigContext);
  if (!context) throw new Error("useConfig must be used inside <ConfigProvider>");
  return context;
}
