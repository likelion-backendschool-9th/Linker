'use client';

// `[Included]` job ad card (07 TODO 24 "Job ads"), shared by 24 feed and 04's job ad sheet
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, MoreHorizontal, X } from 'lucide-react';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { jobCategoriesOptions } from '@/features/job-categories/job-category-queries';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { clickAd, dismissAd, type RecruiterAd } from './ad-api';
import styles from './recruiter-ad-card.module.css';

type RecruiterAdCardProps = {
  ad: RecruiterAd;
  /** Collapse it in the list after X (7 days) */
  onDismissed: (adId: number) => void;
  /** The toast's "되돌리기" brought it back */
  onRestored: (adId: number) => void;
};

/**
 * "광고" is read first, then company, title, job category and closing date. The whole card opens the
 * posting: the click is recorded, then the URL goes through the external-link confirm (blueprint ch. 15).
 */
export function RecruiterAdCard({ ad, onDismissed, onRestored }: RecruiterAdCardProps) {
  const openExternal = useOpenExternal();
  const menu = useOverlay('ad-menu');
  const categories = useQuery(jobCategoriesOptions());
  const category =
    categories.data?.find((item) => item.key === ad.jobCategory)?.label ?? ad.jobCategory;
  const titleId = `ad-${ad.adId}-title`;

  const open = useMutation({
    mutationFn: () => clickAd(ad.adId),
    onSuccess: ({ url }) => openExternal(url),
    onError: () => toast('공고를 열지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' }),
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

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.top}>
        <p className={styles.label}>
          광고<span className="sr-only">,</span>
        </p>
        <p className={styles.company}>{ad.companyName}</p>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={() => menu.open(String(ad.adId))}>
            <MoreHorizontal aria-hidden />
            <span className="sr-only">광고 더보기</span>
          </button>
          <button
            type="button"
            className={styles.tool}
            disabled={dismiss.isPending}
            onClick={() => dismiss.mutate()}
          >
            <X aria-hidden />
            <span className="sr-only">광고 닫기</span>
          </button>
        </div>
      </div>
      <h2 id={titleId} className={styles.title}>
        {ad.title}
      </h2>
      <p className={styles.meta}>
        {category} · <time dateTime={ad.closesOn}>{formatDate(ad.closesOn)}</time> 마감
      </p>
      <button
        type="button"
        className={styles.open}
        aria-disabled={open.isPending}
        onClick={() => {
          if (!open.isPending) open.mutate();
        }}
      >
        외부 공고 보기
        <ExternalLink aria-hidden className={styles.openIcon} />
      </button>
    </article>
  );
}
