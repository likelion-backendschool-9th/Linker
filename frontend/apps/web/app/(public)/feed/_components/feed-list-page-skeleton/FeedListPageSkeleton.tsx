'use client';

import { PenLinearIcon } from '@solar-icons/static/linear/pen';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './FeedListPageSkeleton.module.css';

const TABS = [
  { key: 'recommended', label: '추천' },
  { key: 'following', label: '팔로잉' },
] as const;

/** Figma 999:1219 "24-스켈레톤" — 추천/팔로잉 tabs, card/meta bones, write FAB. */
export function FeedListPageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.feed} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <div className={styles.chromeSlot}>
        <div role="tablist" aria-label="피드 종류" className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={tab.key === 'recommended'}
              tabIndex={-1}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.panel} aria-hidden>
        <span className={`${styles.bone} ${styles.card}`} />
        <div className={styles.metaRow}>
          <span className={`${styles.bone} ${styles.meta}`} />
          <span className={`${styles.bone} ${styles.time}`} />
        </div>
        <span className={`${styles.bone} ${styles.meta}`} />
      </div>
      <div className={styles.fabLayer} aria-hidden>
        <span className={styles.fab}>
          <span
            className={styles.fabIcon}
            dangerouslySetInnerHTML={{ __html: PenLinearIcon }}
          />
        </span>
      </div>
    </div>
  );
}
