"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { BFF_BASE, localRoutes, routes } from "@/shared/api/routes";
import { useConfig } from "./ConfigProvider";
import {
  isUser,
  type APIResponse,
  type ActorId,
  type MeResponse,
  type User,
} from "@/shared/contracts";

/**
 * Session state for the whole app.
 *
 * Holds NO tokens. The access, refresh and actor tokens live in httpOnly
 * cookies that JavaScript cannot read — that is the point of them. What the UI
 * actually needs is who you are and whether we know yet, which is all this is.
 *
 * The value is seeded from the server (`/auth/me` during SSR) so the very
 * first paint is already correct. Fetching it on mount instead would render
 * "Sign in" to a signed-in user for a frame, and a header that flickers
 * between two states on every page load reads as broken.
 */
export type Session =
  /** Only before the first server-provided value — normally never seen. */
  | { readonly status: "loading" }
  | { readonly status: "anonymous"; readonly actorId: ActorId | null }
  | { readonly status: "authenticated"; readonly user: User };

interface AuthContextValue {
  session: Session;
  /** Convenience: the user, or null. */
  user: User | null;
  isAuthenticated: boolean;
  /** True while a sign-out or refresh is in flight. */
  isPending: boolean;
  /** Re-read `/auth/me`. Call after a flow that changed cookies out of band. */
  refresh: () => Promise<void>;
  signOut: (options?: { allDevices?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Queries whose data belongs to the current identity. Invalidated on every
 *  session change so a signed-out user never sees the previous user's saves. */
const IDENTITY_SCOPED = ["me", "markers", "catalogs", "recent", "comments"] as const;

export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession: Session;
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session>(initialSession);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { dataSource } = useConfig();

  const clearIdentityCaches = useCallback(() => {
    for (const key of IDENTITY_SCOPED) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  const refresh = useCallback(async () => {
    try {
      // Sample mode answers locally; there is no backend to proxy to. The
      // shapes are identical, so nothing below this line branches.
      const endpoint =
        dataSource === "fixtures" ? localRoutes.session() : `${BFF_BASE}${routes.me()}`;

      const response = await fetch(endpoint, {
        headers: { accept: "application/json" },
        // The session is the one thing that must never come from a cache.
        cache: "no-store",
      });

      const body = (await response.json()) as APIResponse<MeResponse>;

      if (!body.success || !body.data) {
        setSession({ status: "anonymous", actorId: null });
      } else if (isUser(body.data)) {
        setSession({ status: "authenticated", user: body.data });
      } else {
        setSession({ status: "anonymous", actorId: body.data.actor_id });
      }
    } catch {
      // A failed probe is not proof of being signed out — the network may
      // simply be down. Leaving the last known session in place avoids
      // throwing the user out of the UI over a dropped request.
      return;
    }

    clearIdentityCaches();
  }, [clearIdentityCaches, dataSource]);

  const signOut = useCallback(
    async ({ allDevices = false }: { allDevices?: boolean } = {}) => {
      // Optimistic: the cookies are about to be cleared regardless, and
      // waiting would leave a signed-out user staring at their own avatar.
      setSession({ status: "anonymous", actorId: null });

      try {
        await fetch(localRoutes.signOut(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ all_devices: allDevices }),
        });
      } finally {
        // Runs even if revocation failed: the local cookies are gone either
        // way, so cached identity data must not survive.
        clearIdentityCaches();
      }
    },
    [clearIdentityCaches],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session.status === "authenticated" ? session.user : null,
      isAuthenticated: session.status === "authenticated",
      isPending,
      refresh: () =>
        new Promise<void>((resolve) => {
          startTransition(() => {
            void refresh().then(resolve);
          });
        }),
      signOut,
    }),
    [session, isPending, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** The common case: just the session. */
export function useSession(): Session {
  return useAuth().session;
}
