import type { ErrorCategory, ErrorEnvelope, FieldViolation } from "@/shared/contracts";

/**
 * A failure from the backend, carrying the full error envelope.
 *
 * The UI branches on `category`, never on `status`. Status is a transport
 * detail and several categories share one — `BLOG_NOT_FOUND` and
 * `USER_NOT_FOUND` are both 404 but mean entirely different things to a
 * screen, and the backend's mapping is deliberately unusual in places
 * (body validation is 400, while 422 is reserved for the semantically
 * impossible).
 */
export class ApiError extends Error {
  readonly category: ErrorCategory;
  readonly status: number;
  readonly correlationId: string;
  readonly envelope: ErrorEnvelope;

  constructor(envelope: ErrorEnvelope, status: number) {
    // `safe_message` is guaranteed caller-safe by the backend, so it can be
    // shown to a reader verbatim.
    super(envelope.safe_message);
    this.name = "ApiError";
    this.envelope = envelope;
    this.category = envelope.category;
    this.status = status;
    this.correlationId = envelope.correlation_id;
  }

  /** True when retrying the identical request could plausibly succeed. */
  get retryable(): boolean {
    return this.envelope.retryability === "RETRYABLE";
  }

  /** Per-field messages from a `REQUEST_INVALID`, keyed by field path
   *  (`body.email`). Empty for every other category. */
  get fieldErrors(): Readonly<Record<string, string>> {
    const fields = this.envelope.safe_details.fields as readonly FieldViolation[] | undefined;
    if (!fields) return {};

    const out: Record<string, string> = {};
    for (const { field, reason } of fields) {
      // First message per field wins — later ones are usually a cascade from
      // the same root cause and add noise rather than information.
      out[field] ??= reason;
    }
    return out;
  }

  is(...categories: readonly ErrorCategory[]): boolean {
    return categories.includes(this.category);
  }
}

/**
 * The network never answered — DNS failure, connection refused, offline, or a
 * response that was not JSON at all. Distinct from `ApiError`, which means the
 * server answered and said no.
 */
export class NetworkError extends Error {
  // `Error.cause` exists as of ES2022, so this narrows the base member rather
  // than introducing a new one.
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/** Categories that mean "sign in and try again" rather than "this failed". */
const AUTH_CATEGORIES: readonly ErrorCategory[] = [
  "AUTH_REQUIRED",
  "AUTH_TOKEN_INVALID",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_TOKEN_REVOKED",
  "REFRESH_TOKEN_INVALID",
  "REFRESH_TOKEN_EXPIRED",
  "REFRESH_TOKEN_REUSED",
];

export function isAuthError(error: unknown): boolean {
  return isApiError(error) && error.is(...AUTH_CATEGORIES);
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.is("BLOG_NOT_FOUND", "BLOG_NOT_PUBLISHED");
}

/**
 * Whether a failed request is worth repeating.
 *
 * Transport failures are retried because they are usually transient. Server
 * answers are retried only when the server itself said they were retryable —
 * repeating a 404 or a validation failure just wastes a round trip, and
 * repeating a 401 can spend a single-use refresh token a second time.
 */
export function shouldRetry(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  if (isApiError(error)) return error.retryable;
  return false;
}

/**
 * A message safe to render for any failure, including ones we did not shape.
 *
 * `ApiError.message` is the backend's `safe_message`, so it can be shown as
 * is. An unknown throw gets a generic line rather than `String(error)`, which
 * would leak a stack trace or an internal path into the page.
 */
export function messageFor(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (isNetworkError(error)) return "We could not reach the server. Check your connection.";
  return "Something went wrong.";
}

/** The id to show on an error screen so a user's report can be traced in the
 *  server logs. Absent for transport failures, which never reached the server. */
export function correlationIdOf(error: unknown): string | null {
  return isApiError(error) ? error.correlationId : null;
}
