'use client';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './SubscriptionPageSkeleton.module.css';

/** Figma 999:1350 "29-스켈레톤" — plan card bone + two info-row bones. */
export function SubscriptionPageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <span className={`${styles.bone} ${styles.card}`} aria-hidden />
      <span className={`${styles.bone} ${styles.line}`} aria-hidden />
      <span className={`${styles.bone} ${styles.line}`} aria-hidden />
    </div>
  );
}
