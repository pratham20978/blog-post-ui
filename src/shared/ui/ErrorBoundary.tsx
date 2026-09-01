"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { correlationIdOf, messageFor } from "@/shared/api/errors";

import { Button } from "./Button";

/**
 * Catches render-time failures in the client tree.
 *
 * Next.js `error.tsx` files handle failures per route segment; this covers the
 * widgets that live outside a segment boundary — the header, the toast layer,
 * anything in the providers — where a throw would otherwise blank the whole
 * document.
 *
 * Still a class component: `componentDidCatch` has no hook equivalent.
 */
interface Props {
  children: ReactNode;
  /** Replaces the default panel. Receives the error and a reset callback. */
  fallback?: (error: unknown, reset: () => void) => ReactNode;
}

interface State {
  error: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Left as console for now. When an error reporter is added, this is the
    // single place it hooks in.
    console.error("Unhandled render error", error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const correlationId = correlationIdOf(error);

    return (
      <div role="alert" className="border border-rule bg-surface px-5 py-6">
        <p className="text-subheading font-semibold text-fg">Something went wrong</p>
        <p className="mt-2 text-[0.9375rem] text-muted">{messageFor(error)}</p>

        {correlationId && (
          // The one detail that makes a user's report findable in the server
          // logs, which all share this id for the failing request.
          <p className="mt-3 font-mono text-meta text-muted">
            Reference: {correlationId}
          </p>
        )}

        <Button variant="secondary" size="sm" onClick={this.reset} className="mt-5">
          Try again
        </Button>
      </div>
    );
  }
}
