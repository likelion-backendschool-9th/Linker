'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';

import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './RecruitListPageSkeleton.module.css';

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'mine', label: '내 모집글' },
  { key: 'applied', label: '내 지원' },
] as const;

/** Figma 999:761 "19-스켈레톤" — tabs, 최신순, count/chip/title/body bones, write FAB. */
export function RecruitListPageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <div role="tablist" aria-label="모집 목록" className={styles.tabs}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={item.key === 'all'}
            aria-current={item.key === 'all' ? 'page' : undefined}
            tabIndex={-1}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.toolbar} aria-hidden>
        <span className={`${styles.bone} ${styles.count}`} />
        <span className={styles.sort}>
          최신순
          <span
            className={styles.sortIcon}
            dangerouslySetInnerHTML={{ __html: AltArrowDownLinearIcon }}
          />
        </span>
      </div>
      <div className={styles.card} aria-hidden>
        <span className={`${styles.bone} ${styles.badge}`} />
        <div className={styles.textBlock}>
          <span className={`${styles.bone} ${styles.title}`} />
          <span className={`${styles.bone} ${styles.body}`} />
        </div>
      </div>
      <div className={styles.fabLayer} aria-hidden>
        <span className={styles.fab}>
          <span className={styles.fabVisual}>
            <span
              className={styles.fabIcon}
              dangerouslySetInnerHTML={{ __html: AddBoldIcon }}
            />
          </span>
        </span>
      </div>
    </div>
  );
}
