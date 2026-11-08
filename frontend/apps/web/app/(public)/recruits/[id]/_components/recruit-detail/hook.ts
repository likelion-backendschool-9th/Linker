'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { useViewer } from '@/lib/auth/viewer-context';
import { daysUntil } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  cancelApplication,
  recruitDetailOptions,
  type RecruitDetail as Detail,
} from '../../_lib/detail-queries';

const TABS = ['post', 'applicants'] as const;

export function useRecruitDetail(recruitId: string) {
  const viewer = useViewer();
  const detail = useQuery(recruitDetailOptions(viewer.login, recruitId));
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('post'));

  return {
    detail,
    recruit: detail.data,
    tab,
    setTab: (next: (typeof TABS)[number]) => void setTab(next),
    showApplicants: () => void setTab('applicants'),
  };
}

export function usePostView(recruit: Detail) {
  const menu = useOverlay('recruit-menu');
  const days = daysUntil(recruit.deadline);
  const closed = recruit.status === 'CLOSED' || days < 0;
  return { openMenu: () => menu.open(), days, closed };
}

export function useActionPanel(recruit: Detail) {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const client = useQueryClient();
  const applySheet = useOverlay('recruit-apply');
  const confirm = useOverlay('application-cancel');
  const cancel = useMutation({
    mutationFn: cancelApplication,
    onSuccess: async () => {
      confirm.close();
      toast('지원을 취소했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });
  const mine = recruit.myApplication;
  const suspended = viewer.status === 'SUSPENDED';

  return {
    viewer,
    mine,
    suspended,
    confirm,
    cancelPending: cancel.isPending,
    openApply: () => {
      if (suspended || !requireLogin()) return;
      applySheet.open();
    },
    openCancel: () => {
      if (mine?.status === 'PENDING') confirm.open(String(mine.id));
    },
    confirmCancel: () => {
      if (mine?.status === 'PENDING' && String(mine.id) === confirm.id && !suspended)
        cancel.mutate(mine.id);
    },
  };
}
