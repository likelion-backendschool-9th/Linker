'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  deleteComment,
  postKeys,
  type PostComment,
  type PostDetail,
} from '../../_lib/post-detail-queries';

const DELETE_PREFIX = 'comment:';

type UseCommentMenuSheetArgs = {
  post: PostDetail;
  comments: PostComment[];
};

export function useCommentMenuSheet({ post, comments }: UseCommentMenuSheetArgs) {
  const viewer = useViewer();
  const client = useQueryClient();
  const menu = useOverlay('comment-menu');
  const deleteDialog = useOverlay('delete-confirm');
  const report = useOverlay('report');
  const postId = String(post.id);
  const comment = comments.find((item) => String(item.id) === menu.id);
  const mine = comment !== undefined && comment.author.login === viewer.login;
  const deleting = deleteDialog.id?.startsWith(DELETE_PREFIX)
    ? comments.find((item) => `${DELETE_PREFIX}${item.id}` === deleteDialog.id)
    : undefined;

  const remove = useMutation({
    mutationFn: (commentId: number) => deleteComment(postId, commentId),
    onSuccess: async () => {
      deleteDialog.close();
      toast('댓글을 삭제했어요.');
      await Promise.all([
        client.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        client.invalidateQueries({ queryKey: postKeys.detail(viewer.login, postId) }),
      ]);
    },
  });

  const hasReplies = (target: PostComment) => comments.some((item) => item.parentId === target.id);

  return {
    menu,
    deleteDialog,
    report,
    comment,
    mine,
    deleting,
    isAuthor: post.isAuthor,
    removePending: remove.isPending,
    hasReplies,
    openDelete: (commentId: number) => deleteDialog.open(`${DELETE_PREFIX}${commentId}`),
    confirmDelete: () => {
      if (deleting && !remove.isPending) remove.mutate(deleting.id);
    },
  };
}
