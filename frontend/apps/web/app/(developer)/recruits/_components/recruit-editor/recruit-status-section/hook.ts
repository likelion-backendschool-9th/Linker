'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { closeRecruit, deleteRecruit, recruitStatusErrorMessage, reopenRecruit } from './api';

/** Same top error toast as the editor form above it, with copy per server code */
function showFailure(error: unknown) {
  const message = recruitStatusErrorMessage(error);
  if (!message) return;
  toast(message, { tone: 'error', placement: 'top', key: 'recruit-editor-error' });
}

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
    // ROLES_FULL / DEADLINE_PASSED get their own toast; PLAN_LIMIT opens the shared limit sheet
    onError: (error) => {
      statusDialog.close();
      showFailure(error);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteRecruit(recruitId),
    onSuccess: async () => {
      onDeleted();
      toast('모집 글을 삭제했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
      await deleteDialog.closeAnd(() => router.replace('/recruits?tab=mine' as Route));
    },
    onError: showFailure,
  });

  return {
    open,
    statusDialog,
    deleteDialog,
    toggle,
    remove,
  };
}
