"use client";

import type { ReactNode } from "react";

import type { AppConfig } from "@/shared/config";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";

import { AuthProvider, type Session } from "./AuthProvider";
import { ConfigProvider } from "./ConfigProvider";
import { EngagementProvider } from "./EngagementProvider";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

/**
 * The provider stack, composed once.
 *
 * The order is a dependency order, not a preference — each provider may use
 * the ones outside it and none may use the ones inside:
 *
 *   Config       reads nothing; everything else may read it
 *   Theme        independent, but outside Query so a theme change never
 *                  invalidates cached data
 *   Query        AuthProvider invalidates identity-scoped queries, so the
 *                  client must exist before it
 *   Auth         EngagementProvider records events attributed to the caller
 *   Engagement   toasts can be raised from a beacon failure path
 *   Toast        the last thing that should still work when a screen throws
 *   ErrorBoundary  innermost, so a failed screen keeps the header, the theme
 *                  and the toast layer alive around it
 *
 * `initialSession` and `config` are resolved on the server and passed in, so
 * the first paint is already correct — see AuthProvider for why that matters.
 */
export function AppProviders({
  config,
  initialSession,
  children,
}: {
  config: AppConfig;
  initialSession: Session;
  children: ReactNode;
}) {
  return (
    <ConfigProvider config={config}>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider initialSession={initialSession}>
            <EngagementProvider>
              <ToastProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
              </ToastProvider>
            </EngagementProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ConfigProvider>
  );
}
