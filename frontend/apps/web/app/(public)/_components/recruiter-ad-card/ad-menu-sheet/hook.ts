'use client';

import { useMutation } from '@tanstack/react-query';

import { reportTargetId } from '@/features/report/report-target';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { hideAd } from './api';

export function useAdMenuSheet(onHidden: (adId: number) => void) {
  const menu = useOverlay('ad-menu');
  const report = useOverlay('report');
  const adId = Number(menu.id);

  const hide = useMutation({
    mutationFn: (id: number) => hideAd(id),
    onSuccess: (_result, id) => {
      menu.close();
      onHidden(id);
      toast('이 광고는 다시 보이지 않아요.');
    },
    onError: () => toast('광고를 숨기지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'error' }),
  });

  return {
    menu,
    adId,
    hidePending: hide.isPending,
    hideAd: () => hide.mutate(adId),
    openReport: () => report.open(reportTargetId('RECRUITER_AD', adId)),
  };
}
