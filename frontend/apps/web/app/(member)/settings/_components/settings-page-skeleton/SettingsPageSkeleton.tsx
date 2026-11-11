'use client';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './SettingsPageSkeleton.module.css';

/** Figma 982:491 "6-스켈레톤" — account labels stay real; values shimmer. */
export function SettingsPageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.content} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <section className={styles.group} aria-labelledby="settings-skeleton-account">
        <h2 id="settings-skeleton-account" className={styles.groupTitle}>
          계정 및 연결
        </h2>
        <div className={styles.card} aria-hidden>
          <div className={styles.row}>
            <span>GitHub 연결</span>
            <span className={styles.trailing}>
              <span className={`${styles.bone} ${styles.github}`} />
            </span>
          </div>
          <div className={styles.row}>
            <span>이메일</span>
            <span className={styles.trailing}>
              <span className={`${styles.bone} ${styles.email}`} />
            </span>
          </div>
          <div className={styles.row}>
            <span>구독과 결제</span>
            <span className={styles.trailing}>
              <span className={`${styles.bone} ${styles.plan}`} />
            </span>
          </div>
          <div className={styles.row}>
            <span>로그아웃</span>
          </div>
          <div className={styles.row}>
            <span>계정 삭제</span>
          </div>
        </div>
      </section>
    </div>
  );
}
