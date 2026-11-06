'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { closeRecruit, deleteRecruit, reopenRecruit } from './api';

export function useRecruitStatusSection({
  recruitId,
  status,
  onDeleted,
}: {
  recruitId: string;
  status: 'OPEN' | 'CLOSED';
  onDeleted: () => void;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const statusDialog = useOverlay('recruit-status');
  const deleteDialog = useOverlay('delete-confirm');
  const open = status === 'OPEN';

  const toggle = useMutation({
    mutationFn: () => (open ? closeRecruit(recruitId) : reopenRecruit(recruitId)),
    onSuccess: async () => {
      statusDialog.close();
      toast(open ? '모집을 마감했어요.' : '다시 모집을 시작했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    // PLAN_LIMIT on reopen opens the shared limit sheet
    onError: () => statusDialog.close(),
  });
  const remove = useMutation({
    mutationFn: () => deleteRecruit(recruitId),
    onSuccess: async () => {
      onDeleted();
      toast('모집 글을 삭제했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
      await deleteDialog.closeAnd(() => router.replace('/recruits?tab=mine' as Route));
    },
  });

  return {
    open,
    statusDialog,
    deleteDialog,
    toggle,
    remove,
  };
}
