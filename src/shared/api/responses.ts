import { NextResponse } from "next/server";

import type {
  APIResponse,
  ErrorCategory,
  ErrorEnvelope,
  ProcessingStage,
  Retryability,
} from "@/shared/contracts";

/**
 * Envelope builders for the frontend's own route handlers.
 *
 * Routes under `app/api/` answer the browser directly, and they must be
 * indistinguishable from the backend's responses: the client unwraps every
 * reply through the same `APIResponse<T>` and branches on `error.category`.
 * A route that invented its own JSON shape would be a second contract for
 * callers to special-case.
 *
 * `ErrorCategory` is a closed set mirrored from the backend, so a route cannot
 * make up a category — which is the point. If none of them fits, the honest
 * answers are `INTERNAL_ERROR` or `REQUEST_INVALID`.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse<APIResponse<T>> {
  return NextResponse.json<APIResponse<T>>(
    { success: true, message: "OK", data, error: null },
    init,
  );
}

export function fail(
  status: number,
  category: ErrorCategory,
  safeMessage: string,
  options: {
    stage?: ProcessingStage;
    retryability?: Retryability;
    details?: Readonly<Record<string, unknown>>;
  } = {},
): NextResponse<APIResponse<never>> {
  const error: ErrorEnvelope = {
    category,
    safe_message: safeMessage,
    retryability: options.retryability ?? "NOT_RETRYABLE",
    stage: options.stage ?? "VALIDATE",
    safe_details: options.details ?? {},
    // Present for the same reason the backend sets one: it is what makes a
    // reader's screenshot findable in the logs.
    correlation_id: crypto.randomUUID(),
  };

  return NextResponse.json<APIResponse<never>>(
    { success: false, message: safeMessage, data: null, error },
    { status },
  );
}
