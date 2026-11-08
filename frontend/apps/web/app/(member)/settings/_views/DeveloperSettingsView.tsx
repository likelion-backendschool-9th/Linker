'use client';

import Link from 'next/link';

import type { SettingsData } from '../_lib/settings-types';
import { SettingsCommon } from './SettingsCommon';
import styles from './settings-view.module.css';

const JOB_STATUS_LABEL = { SEEKING: '구직 중', OPEN: '제안만 받기', OFF: '끔' } as const;

export function DeveloperSettingsView({
  login,
  settings,
  jobStatus,
  blockCount,
}: {
  login: string;
  settings: SettingsData;
  jobStatus: keyof typeof JOB_STATUS_LABEL;
  blockCount: number;
}) {
  return (
    <SettingsCommon
      login={login}
      settings={settings}
      blockCount={blockCount}
      accountStart={
        <div className={styles.row}>
          <h2 className={styles.rowLabel}>GitHub 연결</h2>
          <span className={styles.trailing}>
            {settings.github?.login && <span>@{settings.github.login}</span>}
            {settings.github?.connected ? (
              <span className={styles.connected}><span className={styles.dot} aria-hidden="true" />연결 됨</span>
            ) : (
              <span className={styles.value}>연결 안 됨</span>
            )}
          </span>
        </div>
      }
      personal={
        <Link className={styles.row} href="/settings/profile">
          <span>구직 상태</span>
          <span className={styles.trailing}><span className={styles.value}>{JOB_STATUS_LABEL[jobStatus]}</span><Chevron /></span>
        </Link>
      }
    />
  );
}

function Chevron() {
  return <span className={styles.chevron} aria-hidden="true" />;
}
