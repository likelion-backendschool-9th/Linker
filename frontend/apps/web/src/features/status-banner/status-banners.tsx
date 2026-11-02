'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { toKst } from '@/lib/format/time';
import { useAppSignalStore } from '@/stores/app-signal-store';

import styles from './status-banners.module.css';

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function suspensionText(until: string | null): string {
  if (!until) return '운영 정책 위반으로 이용이 제한됐어요.';
  const date = toKst(until);
  return `운영 정책 위반으로 ${date.getMonth() + 1}월 ${date.getDate()}일까지 이용이 제한됐어요.`;
}

/** Common banners (07 TODO 00, 04 ch. 2 and ch. 12): offline, GitHub unstable, suspended. Rendered by `PageFrame`. */
export function StatusBanners() {
  const viewer = useViewer();
  const githubUnavailable = useAppSignalStore((state) => state.githubUnavailable);
  const suspendedByApi = useAppSignalStore((state) => state.suspended);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const suspended = viewer.status === 'SUSPENDED' || suspendedByApi;

  return (
    <div className={styles.banners}>
      <div role="status" className={styles.live}>
        {!online && (
          <p className={styles.banner}>
            인터넷 연결이 끊겼어요. 연결되면 자동으로 다시 불러올게요.
          </p>
        )}
        {githubUnavailable && (
          <p className={styles.banner}>GitHub 연결이 불안정해 최신 정보가 아닐 수 있어요.</p>
        )}
      </div>
      {suspended && (
        <p className={`${styles.banner} ${styles.warning}`}>
          {suspensionText(viewer.suspendedUntil)}{' '}
          {/* Appeals start from the sanction notification (04 ch. 9 "Appeals") */}
          <Link href={'/notifications' as Route} className={styles.link}>
            이의 제기하기
          </Link>
        </p>
      )}
    </div>
  );
}
