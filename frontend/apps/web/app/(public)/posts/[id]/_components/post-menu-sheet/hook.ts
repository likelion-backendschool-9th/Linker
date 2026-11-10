'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { reportTargetId } from '@/features/report/report-target';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { deletePost, postDetailOptions, type PostDetail } from '../../_lib/post-detail-queries';

const DELETE_ID = 'post';

/**
 * Header "더보기" dropdown (Figma 622:216). The header sits outside PostDetail, so it reads the
 * post from the query cache the page already filled. Guests get the login prompt instead.
 */
export function usePostMenuButton(postId: string) {
  const viewer = useViewer();
  const router = useRouter();
  const requireLogin = useRequireLogin();
  const report = useOverlay('report');
  const deleteDialog = useOverlay('delete-confirm');
  const post = useQuery(postDetailOptions(viewer.login, postId)).data;

  return {
    post,
    isGuest: viewer.role === 'guest',
    promptLogin: () => requireLogin(),
    openReport: () => {
      if (post) report.open(reportTargetId('POST', post.id));
    },
    openEdit: () => router.push(`/posts/${postId}/edit` as Route),
    openDelete: () => deleteDialog.open(DELETE_ID),
  };
}

/** Delete confirm opened from the dropdown (author only) */
export function usePostDeleteDialog(post: PostDetail) {
  const router = useRouter();
  const client = useQueryClient();
  const deleteDialog = useOverlay('delete-confirm');

  const remove = useMutation({
    mutationFn: () => deletePost(String(post.id)),
    onSuccess: async () => {
      toast('게시물을 삭제했어요.');
      await deleteDialog.closeAnd(() => router.replace('/feed'));
      await client.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  return {
    overlay: { ...deleteDialog, isOpen: deleteDialog.isOpen && deleteDialog.id === DELETE_ID },
    removePending: remove.isPending,
    confirmDelete: () => {
      if (!remove.isPending) remove.mutate();
    },
  };
}
