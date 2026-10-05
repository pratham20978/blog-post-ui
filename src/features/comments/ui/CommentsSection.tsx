"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useConfig } from "@/app/providers/ConfigProvider";
import { useToast } from "@/app/providers/ToastProvider";
import type { BlogId, Comment, CommentId, User, UserId } from "@/shared/contracts";
import { useInView } from "@/shared/lib/useInView";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/primitives";

import { authorLabel, commentErrorMessage } from "../model/format";
import { commentsQuery, useCreateComment } from "../model/queries";

import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";

/**
 * The discussion under an article.
 *
 * Fetched only as the reader nears it: most readers never scroll this far, and
 * an uncached request on every article view is load the backend does not need.
 * Only from the API, too — sample mode has no discussion to show.
 *
 * Threads are one level deep because the schema allows nothing deeper, and a
 * reader gets one top-level comment per article (replies are unlimited), so
 * the form gives way to a note once theirs is on the page.
 */
export function CommentsSection({ blogId, authorId }: { blogId: BlogId; authorId: UserId }) {
  const { dataSource } = useConfig();
  const { session, user } = useAuth();
  const [ref, near] = useInView<HTMLElement>({ rootMargin: "600px 0px", once: true });
  const comments = useInfiniteQuery({
    ...commentsQuery(blogId),
    enabled: near && dataSource === "api",
  });
  const [replyingTo, setReplyingTo] = useState<CommentId | null>(null);

  const threads = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const commented = user !== null && threads.some((thread) => thread.root.user_id === user.id);

  return (
    <section
      ref={ref}
      // Namespaced: an article heading titled "Comments" already owns `#comments`.
      id="article-comments"
      aria-labelledby="article-comments-heading"
      className="mx-auto mt-16 max-w-[var(--measure)] border-t border-rule pt-8"
    >
      <h2
        id="article-comments-heading"
        className="text-heading font-semibold tracking-title text-fg"
      >
        Comments
      </h2>

      {dataSource !== "api" ? (
        <p className="mt-4 text-[0.9375rem] text-muted">
          Comments come from the API, so sample mode has none to show.
        </p>
      ) : (
        <>
          <div className="mt-6">
            {session.status === "authenticated" ? (
              commented ? (
                <p className="text-[0.9375rem] text-muted">
                  You have commented on this article. To write a new comment, edit or delete
                  yours below.
                </p>
              ) : (
                <NewComment blogId={blogId} viewer={session.user} />
              )
            ) : session.status === "anonymous" ? (
              <p className="text-[0.9375rem] text-muted">
                <Link href="/login" className="text-fg underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to join the discussion.
              </p>
            ) : null}
          </div>

          {comments.isError && !comments.data ? (
            <div className="mt-8 border border-rule bg-surface px-5 py-6 text-center">
              <p className="text-[0.9375rem] text-muted">Comments could not be loaded.</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => void comments.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : !comments.data ? (
            <LoadingThreads />
          ) : threads.length === 0 ? (
            <p className="mt-8 text-[0.9375rem] text-muted">No comments yet.</p>
          ) : (
            <>
              <ol className="mt-8 flex flex-col gap-8">
                {threads.map(({ root, replies }) => {
                  const replying = user !== null && replyingTo === root.id;

                  return (
                    <li key={root.id}>
                      <CommentItem
                        comment={root}
                        blogId={blogId}
                        authorId={authorId}
                        viewer={user}
                        hasReplies={replies.length > 0}
                        onReply={user ? () => setReplyingTo(root.id) : undefined}
                      />

                      {(replies.length > 0 || replying) && (
                        <ol className="ml-4 mt-5 flex flex-col gap-6 border-l border-rule pl-4 sm:ml-11">
                          {replies.map((reply) => (
                            <li key={reply.id}>
                              <CommentItem
                                comment={reply}
                                blogId={blogId}
                                authorId={authorId}
                                viewer={user}
                              />
                            </li>
                          ))}
                          {replying && (
                            <li>
                              <ReplyForm
                                blogId={blogId}
                                parent={root}
                                viewer={user}
                                onDone={() => setReplyingTo(null)}
                              />
                            </li>
                          )}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ol>

              {/* A button, not automatic loading: the footer sits below, and a
                  list that grows whenever it nears the end keeps it out of
                  reach. */}
              {comments.hasNextPage && (
                <div className="mt-8 text-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void comments.fetchNextPage()}
                    disabled={comments.isFetchingNextPage}
                  >
                    {comments.isFetchingNextPage ? "Loading…" : "Show more comments"}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function NewComment({ blogId, viewer }: { blogId: BlogId; viewer: User }) {
  const create = useCreateComment(blogId);
  const { toast } = useToast();

  return (
    <CommentComposer
      label="Add a comment"
      placeholder="Add to the discussion…"
      submitLabel="Post comment"
      hint={`Posting as ${authorLabel({ author_name: viewer.display_name, user_id: viewer.id })}`}
      pending={create.isPending}
      error={create.error ? commentErrorMessage(create.error) : null}
      clearOnSuccess
      onSubmit={async (body) => {
        await create.mutateAsync({ body });
        toast("Comment posted.");
      }}
    />
  );
}

function ReplyForm({
  blogId,
  parent,
  viewer,
  onDone,
}: {
  blogId: BlogId;
  parent: Comment;
  viewer: User;
  onDone: () => void;
}) {
  const create = useCreateComment(blogId);
  const { toast } = useToast();
  const to = authorLabel(parent);

  return (
    <CommentComposer
      label={`Reply to ${to}`}
      placeholder={`Reply to ${to}…`}
      submitLabel="Reply"
      hint={`Replying as ${authorLabel({ author_name: viewer.display_name, user_id: viewer.id })}`}
      pending={create.isPending}
      error={create.error ? commentErrorMessage(create.error) : null}
      onSubmit={async (body) => {
        await create.mutateAsync({ body, parent_comment_id: parent.id });
        toast("Reply posted.");
        onDone();
      }}
      onCancel={onDone}
      autoFocus
    />
  );
}

function LoadingThreads() {
  return (
    <div role="status" className="mt-8 flex flex-col gap-8">
      <span className="sr-only">Loading comments…</span>
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
