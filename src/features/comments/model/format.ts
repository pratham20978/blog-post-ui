import { isApiError, isAuthError, messageFor } from "@/shared/api/errors";
import type { Comment } from "@/shared/contracts";
import { parseInstant } from "@/shared/lib/date";

/**
 * The name shown on a comment.
 *
 * The display name when the account has one. Otherwise "Reader" with a short
 * tag from the account id — enough to tell two unnamed readers apart in one
 * thread, and derived from nothing personal. The id's tail rather than its
 * head: UUIDv7 leads with a timestamp, so accounts made close together share
 * a prefix.
 */
export function authorLabel({ author_name, user_id }: Pick<Comment, "author_name" | "user_id">) {
  return author_name?.trim() || `Reader ${user_id.slice(-4)}`;
}

/** Edited after posting. A second of tolerance, because both timestamps are
 *  stamped by the database and are not guaranteed to be identical on insert. */
export function wasEdited({ created_at, updated_at }: Pick<Comment, "created_at" | "updated_at">) {
  const created = parseInstant(created_at)?.getTime();
  const updated = parseInstant(updated_at)?.getTime();
  return created !== undefined && updated !== undefined && updated - created > 1_000;
}

/** What to tell the reader when a comment write fails. */
export function commentErrorMessage(error: unknown): string {
  if (isApiError(error) && error.is("COMMENT_ALREADY_EXISTS")) {
    return "You have already commented on this article. Edit or delete that comment to write a new one.";
  }
  if (isAuthError(error)) return "Your session has ended. Sign in again to comment.";
  return messageFor(error);
}
