import type { InfiniteData } from "@tanstack/react-query";

import type { Comment, CommentId, CommentThread, Page } from "@/shared/contracts";

/** The cached shape of an article's comments: the thread pages loaded so far.
 *  The page params are left as the query key's tag types them — nothing here
 *  reads them. */
export type CommentPages = InfiniteData<Page<CommentThread>>;

/*
 * A successful write, applied to the cached pages — so the change shows at once
 * instead of refetching every page the reader has loaded. Each follows the
 * order the API lists in, so the next refetch agrees with what is on screen.
 * Pure, so every rule is tested rather than trusted.
 */

/** Roots are listed newest first, so a new one leads the first page. Keyset
 *  cursors make that safe: the next page still begins after the last root it
 *  began after. */
export function withNewRoot(data: CommentPages, comment: Comment): CommentPages {
  const [first, ...rest] = data.pages;
  if (!first) return data;
  return {
    ...data,
    pages: [{ ...first, items: [{ root: comment, replies: [] }, ...first.items] }, ...rest],
  };
}

/** Replies are listed oldest first, so a new one ends its thread. */
export function withNewReply(data: CommentPages, reply: Comment): CommentPages {
  return mapThreads(data, (thread) =>
    thread.root.id === reply.parent_comment_id
      ? { ...thread, replies: [...thread.replies, reply] }
      : thread,
  );
}

/** An edit replaces the comment wherever it sits, root or reply. */
export function withEdited(data: CommentPages, comment: Comment): CommentPages {
  return mapThreads(data, (thread) => {
    if (thread.root.id === comment.id) return { ...thread, root: comment };
    if (!thread.replies.some((reply) => reply.id === comment.id)) return thread;
    return {
      ...thread,
      replies: thread.replies.map((reply) => (reply.id === comment.id ? comment : reply)),
    };
  });
}

/** A deleted root takes its whole thread with it — the API stops listing the
 *  replies of a removed root too. */
export function withoutComment(data: CommentPages, commentId: CommentId): CommentPages {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items
        .filter((thread) => thread.root.id !== commentId)
        .map((thread) =>
          thread.replies.some((reply) => reply.id === commentId)
            ? { ...thread, replies: thread.replies.filter((reply) => reply.id !== commentId) }
            : thread,
        ),
    })),
  };
}

function mapThreads(
  data: CommentPages,
  update: (thread: CommentThread) => CommentThread,
): CommentPages {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.map(update) })),
  };
}
