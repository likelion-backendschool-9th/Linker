'use client';

// `[Included]` job ad card (07 TODO 24 "Job ads"), shared by 24 feed and 04's job ad sheet
import { ExternalLink, MoreHorizontal, X } from 'lucide-react';

import { formatDate } from '@/lib/format/time';

import type { RecruiterAd } from './api';
import { useRecruiterAdCard } from './hook';
import styles from './RecruiterAdCard.module.css';

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
  const {
    category,
    titleId,
    openMenu,
    openPending,
    openAd,
    dismissPending,
    dismissAd,
  } = useRecruiterAdCard({ ad, onDismissed, onRestored });

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.top}>
        <p className={styles.label}>
          광고<span className="sr-only">,</span>
        </p>
        <p className={styles.company}>{ad.companyName}</p>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={openMenu}>
            <MoreHorizontal aria-hidden />
            <span className="sr-only">광고 더보기</span>
          </button>
          <button
            type="button"
            className={styles.tool}
            disabled={dismissPending}
            onClick={dismissAd}
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
        aria-disabled={openPending}
        onClick={openAd}
      >
        외부 공고 보기
        <ExternalLink aria-hidden className={styles.openIcon} />
      </button>
    </article>
  );
}
