'use client';

import { ArrowRightUpLinearIcon } from '@solar-icons/static/linear/arrow-right-up';
import { EllipsisVertical } from 'lucide-react';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './IssueDetailPageSkeleton.module.css';

const INFO_ROWS = [
  { term: '상태', bone: 'value' },
  { term: '라벨', bone: 'value' },
  { term: '담당자', bone: 'assignee' },
  { term: '시작일', bone: 'value' },
  { term: '마감일', bone: 'value' },
] as const;

/** Header more icon (Figma 12); disabled until detail actions mount. */
export function IssueDetailLoadingActions() {
  return (
    <button type="button" className={styles.headerIcon} aria-label="더보기" disabled>
      <EllipsisVertical aria-hidden />
    </button>
  );
}

/** Figma 982:1171 "12-스켈레톤" — title/meta bones + info-card labels with value bones. */
export function IssueDetailPageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <section className={styles.head} aria-hidden>
        <div className={styles.titleRow}>
          <span className={`${styles.bone} ${styles.title}`} />
          <span className={styles.external}>
            <span
              className={styles.externalIcon}
              dangerouslySetInnerHTML={{ __html: ArrowRightUpLinearIcon }}
            />
          </span>
        </div>
        <span className={`${styles.bone} ${styles.meta}`} />
      </section>
      <ul className={styles.card} aria-hidden>
        {INFO_ROWS.map((row) => (
          <li key={row.term}>
            <div className={styles.row}>
              <span className={styles.term}>{row.term}</span>
              <span className={`${styles.bone} ${styles[row.bone]}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
