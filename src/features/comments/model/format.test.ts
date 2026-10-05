import { describe, expect, it } from "vitest";

import { ApiError, NetworkError } from "@/shared/api/errors";
import type { ErrorCategory } from "@/shared/contracts";

import { authorLabel, commentErrorMessage, wasEdited } from "./format";

const USER = "00000000-0000-7000-8000-00000000c0de";

function apiError(category: ErrorCategory, message = "Safe message."): ApiError {
  return new ApiError(
    {
      category,
      safe_message: message,
      retryability: "NOT_RETRYABLE",
      stage: "PERSIST",
      safe_details: {},
      correlation_id: "correlation",
    },
    400,
  );
}

describe("authorLabel", () => {
  it("uses the display name when the account has one", () => {
    expect(authorLabel({ author_name: "Ada Lovelace", user_id: USER })).toBe("Ada Lovelace");
  });

  it("falls back to a neutral label with a short tag from the id", () => {
    expect(authorLabel({ author_name: null, user_id: USER })).toBe("Reader c0de");
    expect(authorLabel({ author_name: "   ", user_id: USER })).toBe("Reader c0de");
  });
});

describe("wasEdited", () => {
  it("ignores the database's own sub-second skew on insert", () => {
    expect(
      wasEdited({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.400Z" }),
    ).toBe(false);
  });

  it("reports a later change", () => {
    expect(
      wasEdited({ created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:05:00Z" }),
    ).toBe(true);
  });
});

describe("commentErrorMessage", () => {
  it("explains the one-comment-per-article rule in the reader's terms", () => {
    expect(commentErrorMessage(apiError("COMMENT_ALREADY_EXISTS"))).toMatch(
      /already commented/,
    );
  });

  it("asks for a fresh sign-in when the session has lapsed", () => {
    expect(commentErrorMessage(apiError("AUTH_REQUIRED"))).toMatch(/sign in again/i);
  });

  it("passes the server's safe message through otherwise", () => {
    expect(commentErrorMessage(apiError("BLOG_NOT_FOUND", "No such article."))).toBe(
      "No such article.",
    );
    expect(commentErrorMessage(new NetworkError("down"))).toMatch(/could not reach/i);
  });
});
