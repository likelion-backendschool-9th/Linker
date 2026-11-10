'use client';

import { EllipsisVertical } from 'lucide-react';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './PostDetailPageSkeleton.module.css';

/** Header more icon (Figma); disabled until PostMenuButton mounts with post data. */
export function PostDetailLoadingActions() {
  return (
    <button type="button" className={styles.headerIcon} aria-label="게시물 더보기" disabled>
      <EllipsisVertical aria-hidden className={styles.headerIconSvg} />
    </button>
  );
}

/** Figma 999:1090 "23-스켈레톤" — cover photo + author avatar/name/login/follow bones. */
export function PostDetailPageSkeleton() {
  useLoaderPresence();

  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <span className={`${styles.bone} ${styles.photo}`} aria-hidden />
      <div className={styles.authorRow} aria-hidden>
        <div className={styles.author}>
          <span className={`${styles.bone} ${styles.avatar}`} />
          <div className={styles.authorText}>
            <span className={`${styles.bone} ${styles.name}`} />
            <span className={`${styles.bone} ${styles.login}`} />
          </div>
        </div>
        <span className={`${styles.bone} ${styles.follow}`} />
      </div>
    </div>
  );
}
