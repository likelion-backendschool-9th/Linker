'use client';

import { useLoaderPresence } from '@/components/ui/page-loading';
import { formatDate, todayKst } from '@/lib/format/time';

import {
  NOTIFICATION_TAB_LABELS,
  NOTIFICATION_TABS,
} from '../../_lib/notification-tab';
import styles from './NotificationListPageSkeleton.module.css';

/** Figma 999:709 "18-스켈레톤" — tabs, 전체 읽기, today heading, unread dot + text bone. */
export function NotificationListPageSkeleton() {
  const today = todayKst();
  useLoaderPresence();

  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <div role="group" aria-label="알림 보기" className={styles.tabs}>
        {NOTIFICATION_TABS.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.tab}
            aria-current={value === 'all' ? 'page' : undefined}
            tabIndex={-1}
          >
            {NOTIFICATION_TAB_LABELS[value]}
          </button>
        ))}
      </div>
      <button type="button" className={styles.readAll} disabled tabIndex={-1}>
        전체 읽기
      </button>
      <section aria-hidden className={styles.days}>
        <section className={styles.group}>
          <h2 className={styles.date}>
            <time dateTime={today}>{formatDate(today)}</time>
            <span className={styles.age}>오늘</span>
          </h2>
          <div className={styles.row}>
            <span className={styles.dot} />
            <span className={styles.bone} />
          </div>
        </section>
      </section>
    </div>
  );
}
