"use client";

import { useState, type ReactNode } from "react";

import { useToast } from "@/app/providers/ToastProvider";
import type { BlogId, Comment, User, UserId } from "@/shared/contracts";
import { formatDate, formatRelative } from "@/shared/lib/date";
import { Button } from "@/shared/ui/Button";
import { Avatar } from "@/shared/ui/primitives";

import { authorLabel, commentErrorMessage, wasEdited } from "../model/format";
import { useDeleteComment, useEditComment } from "../model/queries";

import { CommentComposer } from "./CommentComposer";

/**
 * One comment: who, when, what, and what the reader may do with it.
 *
 * The body is plain text, never Markdown or HTML — it is rendered as a text
 * node, so a comment cannot inject markup however it is written.
 */
export function CommentItem({
  comment,
  blogId,
  authorId,
  viewer,
  hasReplies = false,
  onReply,
}: {
  comment: Comment;
  blogId: BlogId;
  /** The article's author, whose comments are badged. */
  authorId: UserId;
  viewer: User | null;
  hasReplies?: boolean;
  /** Present on top-level comments when the viewer may reply. */
  onReply?: () => void;
}) {
  const { toast } = useToast();
  const edit = useEditComment(blogId);
  const remove = useDeleteComment(blogId);
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

  const name = authorLabel(comment);
  const own = viewer?.id === comment.user_id;
  // The API lets the admin remove any comment; nobody else can remove another's.
  const canDelete = own || viewer?.is_admin === true;

  return (
    <article aria-label={`Comment by ${name}`} className="flex gap-3">
      <Avatar name={name} size={32} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
          <span className="font-medium text-fg">{name}</span>
          {comment.user_id === authorId && <Badge>Author</Badge>}
          {own && <Badge>You</Badge>}
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <time
            dateTime={comment.created_at}
            title={formatDate(comment.created_at)}
            className="text-muted"
          >
            {formatRelative(comment.created_at)}
          </time>
          {wasEdited(comment) && <span className="text-muted">· edited</span>}
        </div>

        {mode === "edit" ? (
          <div className="mt-2">
            <CommentComposer
              label="Edit your comment"
              submitLabel="Save"
              initialValue={comment.body}
              pending={edit.isPending}
              error={edit.error ? commentErrorMessage(edit.error) : null}
              onSubmit={async (body) => {
                await edit.mutateAsync({ id: comment.id, body });
                setMode("view");
                toast("Comment updated.");
              }}
              onCancel={() => {
                edit.reset();
                setMode("view");
              }}
              autoFocus
            />
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-[0.9375rem] leading-relaxed text-fg">
            {comment.body}
          </p>
        )}

        {mode === "confirm-delete" ? (
          <div
            role="group"
            aria-label="Confirm deletion"
            className="mt-3 flex flex-wrap items-center gap-3 text-meta"
          >
            <span className="text-fg">
              {hasReplies
                ? "Delete this comment? Its replies will be removed with it."
                : "Delete this comment?"}
            </span>
            <Button
              variant="danger"
              size="sm"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(comment.id);
                  toast("Comment deleted.");
                } catch {
                  // Shown below; the comment stays.
                }
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                remove.reset();
                setMode("view");
              }}
            >
              Cancel
            </Button>
            {remove.error && (
              <span role="alert" className="w-full text-danger">
                {commentErrorMessage(remove.error)}
              </span>
            )}
          </div>
        ) : (
          mode === "view" &&
          (onReply || own || canDelete) && (
            <div className="mt-2 flex flex-wrap gap-x-4 text-meta">
              {onReply && <Action onClick={onReply}>Reply</Action>}
              {own && <Action onClick={() => setMode("edit")}>Edit</Action>}
              {canDelete && <Action onClick={() => setMode("confirm-delete")}>Delete</Action>}
            </div>
          )
        )}
      </div>
    </article>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-control border border-rule px-1.5 text-eyebrow uppercase tracking-eyebrow text-muted">
      {children}
    </span>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Padding cancelled by margin: a touch-sized target in a dense row.
      className="-my-2 py-2 text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
    >
      {children}
    </button>
  );
}
