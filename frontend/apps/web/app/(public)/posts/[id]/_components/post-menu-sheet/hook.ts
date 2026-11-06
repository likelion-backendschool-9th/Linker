'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { reportTargetId } from '@/features/report/report-target';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { deletePost, type PostDetail } from '../../_lib/post-detail-queries';

const DELETE_ID = 'post';

export function usePostMenuSheet(post: PostDetail) {
  const router = useRouter();
  const client = useQueryClient();
  const menu = useOverlay('post-menu');
  const deleteDialog = useOverlay('delete-confirm');
  const report = useOverlay('report');

  const remove = useMutation({
    mutationFn: () => deletePost(String(post.id)),
    onSuccess: async () => {
      toast('게시물을 삭제했어요.');
      await deleteDialog.closeAnd(() => router.replace('/feed'));
      await client.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  return {
    menu,
    deleteDialog,
    report,
    deleteId: DELETE_ID,
    removePending: remove.isPending,
    openDelete: () => deleteDialog.open(DELETE_ID),
    confirmDelete: () => {
      if (!remove.isPending) remove.mutate();
    },
    openReport: () => report.open(reportTargetId('POST', post.id)),
  };
}
