import { infiniteQueryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { clientFetch } from "@/shared/api/client";
import { BFF_BASE, routes } from "@/shared/api/routes";
import type {
  BlogId,
  Comment,
  CommentBody,
  CommentId,
  CommentThread,
  Page,
} from "@/shared/contracts";

import {
  withEdited,
  withNewReply,
  withNewRoot,
  withoutComment,
  type CommentPages,
} from "./cache";

/** Threads per request. Small, because each thread arrives with every one of
 *  its replies, and most readers read only the first few. */
const PAGE_SIZE = 10;

/** An article's threads, newest first, a page at a time. */
export function commentsQuery(blogId: BlogId) {
  return infiniteQueryOptions({
    // Identity-scoped in AuthProvider: signing in or out refetches it, so
    // whose comment is whose follows the session.
    queryKey: ["comments", blogId],
    queryFn: ({ pageParam, signal }) =>
      clientFetch<Page<CommentThread>>(`${BFF_BASE}${routes.comments(blogId)}`, {
        query: { cursor: pageParam, limit: PAGE_SIZE },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more && last.next_cursor ? last.next_cursor : undefined),
  });
}

/** Applies a successful write to the cached pages, if they are loaded. */
function usePatchComments(blogId: BlogId) {
  const queryClient = useQueryClient();
  return (update: (data: CommentPages) => CommentPages) =>
    queryClient.setQueryData(commentsQuery(blogId).queryKey, (data) => data && update(data));
}

/** A new root comment, or a reply when `parent_comment_id` is set. */
export function useCreateComment(blogId: BlogId) {
  const patch = usePatchComments(blogId);
  return useMutation({
    mutationFn: (body: CommentBody) =>
      clientFetch<Comment>(`${BFF_BASE}${routes.comments(blogId)}`, { method: "POST", body }),
    onSuccess: (comment) =>
      patch((data) =>
        comment.parent_comment_id ? withNewReply(data, comment) : withNewRoot(data, comment),
      ),
  });
}

export function useEditComment(blogId: BlogId) {
  const patch = usePatchComments(blogId);
  return useMutation({
    mutationFn: ({ id, body }: { id: CommentId; body: string }) =>
      clientFetch<Comment>(`${BFF_BASE}${routes.comment(id)}`, {
        method: "PATCH",
        body: { body } satisfies CommentBody,
      }),
    onSuccess: (comment) => patch((data) => withEdited(data, comment)),
  });
}

export function useDeleteComment(blogId: BlogId) {
  const patch = usePatchComments(blogId);
  return useMutation({
    mutationFn: (id: CommentId) =>
      clientFetch<{ comment_id: CommentId }>(`${BFF_BASE}${routes.comment(id)}`, {
        method: "DELETE",
      }),
    onSuccess: (_, id) => patch((data) => withoutComment(data, id)),
  });
}
