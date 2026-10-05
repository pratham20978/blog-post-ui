import type { APIResponse } from "@/shared/contracts";

import { ApiError, NetworkError } from "./errors";

/**
 * Browser-side access to the backend, for client components.
 *
 * The twin of `serverFetch`: the same envelope unwrapping and the same error
 * types, so a caller — usually a React Query hook — gets `data` back or a
 * thrown `ApiError` whose `category` it can branch on. That is also what lets
 * the QueryClient's `shouldRetry` and `messageFor()` work on these requests
 * without special cases.
 *
 * Takes a full same-origin path: `${BFF_BASE}${routes.comments(id)}` for the
 * backend, where the BFF attaches the tokens the browser cannot read, or a
 * `localRoutes` entry for a route the frontend owns.
 */

export interface ClientFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Query parameters. Undefined, null and empty values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export async function clientFetch<T>(path: string, options: ClientFetchOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(withQuery(path, query), {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
      // Everything on this path is per-caller or already cached server-side;
      // the browser's HTTP cache would only serve it stale.
      cache: "no-store",
      signal,
    });
  } catch (cause) {
    // An abort is the caller changing its mind, not a network failure. Let it
    // through untouched so React Query recognises a cancelled request.
    if (signal?.aborted) throw cause;
    throw new NetworkError("Could not reach the server.", cause);
  }

  let payload: APIResponse<T>;
  try {
    payload = (await response.json()) as APIResponse<T>;
  } catch (cause) {
    throw new NetworkError(
      `Server returned a non-JSON response (${response.status}) for ${path}`,
      cause,
    );
  }

  if (!payload.success || payload.error) {
    if (payload.error) throw new ApiError(payload.error, response.status);
    throw new NetworkError(`Server reported failure without an error envelope for ${path}`);
  }

  return payload.data as T;
}

function withQuery(path: string, query?: ClientFetchOptions["query"]): string {
  if (!query) return path;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
