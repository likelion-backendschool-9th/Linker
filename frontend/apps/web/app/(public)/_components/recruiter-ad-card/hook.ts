'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { jobCategoriesOptions } from '@/features/job-categories/job-category-queries';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { clickAd, dismissAd, type RecruiterAd } from './api';

type UseRecruiterAdCardArgs = {
  ad: RecruiterAd;
  onDismissed: (adId: number) => void;
  onRestored: (adId: number) => void;
};

export function useRecruiterAdCard({ ad, onDismissed, onRestored }: UseRecruiterAdCardArgs) {
  const openExternal = useOpenExternal();
  const menu = useOverlay('ad-menu');
  const categories = useQuery(jobCategoriesOptions());
  const category =
    categories.data?.find((item) => item.key === ad.jobCategory)?.label ?? ad.jobCategory;

  const open = useMutation({
    mutationFn: () => clickAd(ad.adId),
    onSuccess: ({ url }) => openExternal(url),
    onError: () => toast('공고를 열지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'error' }),
  });
  const restore = useMutation({
    mutationFn: () => dismissAd(ad.adId, false),
    onSuccess: () => onRestored(ad.adId),
  });
  const dismiss = useMutation({
    mutationFn: () => dismissAd(ad.adId, true),
    onSuccess: () => {
      onDismissed(ad.adId);
      toast('광고를 닫았어요. 7일 동안 보이지 않아요.', {
        action: { label: '되돌리기', onClick: () => restore.mutate() },
      });
    },
  });

  return {
    category,
    titleId: `ad-${ad.adId}-title`,
    openMenu: () => menu.open(String(ad.adId)),
    openPending: open.isPending,
    openAd: () => {
      if (!open.isPending) open.mutate();
    },
    dismissPending: dismiss.isPending,
    dismissAd: () => dismiss.mutate(),
  };
}
