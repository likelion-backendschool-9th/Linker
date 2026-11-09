'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { closeRecruit, deleteRecruit, reopenRecruit } from '@/features/recruit/recruit-status-api';
import { reportTargetId } from '@/features/report/report-target';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { RecruitDetail } from '../../_lib/detail-queries';

export function useRecruitMenuSheet(recruit: RecruitDetail) {
  const router = useRouter();
  const client = useQueryClient();
  const requireLogin = useRequireLogin();
  const statusDialog = useOverlay('recruit-status');
  const deleteDialog = useOverlay('delete-confirm');
  const report = useOverlay('report');
  const open = recruit.status === 'OPEN';

  const toggle = useMutation({
    mutationFn: () => (open ? closeRecruit(recruit.id) : reopenRecruit(recruit.id)),
    onSuccess: async () => {
      statusDialog.close();
      toast(open ? '모집을 마감했어요.' : '다시 모집을 시작했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
    // PLAN_LIMIT on reopen opens the shared limit sheet
    onError: () => statusDialog.close(),
  });
  const remove = useMutation({
    mutationFn: () => deleteRecruit(recruit.id),
    onSuccess: async () => {
      toast('모집 글을 삭제했어요.');
      await deleteDialog.closeAnd(() => router.replace('/recruits?tab=mine' as Route));
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });

  return {
    statusDialog,
    open,
    togglePending: toggle.isPending,
    removePending: remove.isPending,
    confirmToggle: () => {
      if (!toggle.isPending) toggle.mutate();
    },
    confirmDelete: () => {
      if (!remove.isPending) remove.mutate();
    },
    openStatus: () => statusDialog.open(),
    openDelete: () => deleteDialog.open(String(recruit.id)),
    openReport: () => {
      if (!requireLogin()) return;
      report.open(reportTargetId('RECRUIT_POST', recruit.id));
    },
  };
}
