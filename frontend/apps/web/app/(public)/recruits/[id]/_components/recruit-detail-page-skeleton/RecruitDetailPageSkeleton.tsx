'use client';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './RecruitDetailPageSkeleton.module.css';

/** Figma 999:908 "21-스켈레톤" — chip, title, deadline, intro bones under stack header. */
export function RecruitDetailPageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <div className={styles.titleBlock} aria-hidden>
        <div className={styles.titleLead}>
          <span className={`${styles.bone} ${styles.badge}`} />
          <span className={`${styles.bone} ${styles.title}`} />
        </div>
        <span className={`${styles.bone} ${styles.meta}`} />
      </div>
      <span className={`${styles.bone} ${styles.body}`} aria-hidden />
    </div>
  );
}
