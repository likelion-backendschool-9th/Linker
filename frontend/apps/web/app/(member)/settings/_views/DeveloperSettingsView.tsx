'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';

import type { SettingsData } from '../_lib/settings-types';
import { AccountPlan, SettingsCommon } from './SettingsCommon';
import styles from './settings-view.module.css';

export function DeveloperSettingsView({ login, settings }: { login: string; settings: SettingsData }) {
  return (
    <SettingsCommon login={login} settings={settings}>
      <section className={styles.section} aria-labelledby="github-heading">
        <h2 id="github-heading">GitHub 연결</h2>
        {settings.github?.connected ? (
          <div className={styles.row}>
            <div className={styles.rowInfo}><span className={styles.label}>연결된 계정</span><span className={styles.value}>@{settings.github.login}</span></div>
            <span className={styles.value}>연결됨</span>
          </div>
        ) : <p className={styles.description}>연결된 GitHub 계정이 없어요.</p>}
        <p className={styles.description}>연결 및 해제 기능은 현재 제공되는 계정 API에 포함되어 있지 않아요.</p>
      </section>
      <AccountPlan settings={settings} />
      <section className={styles.section} aria-labelledby="profile-heading">
        <h2 id="profile-heading">프로필</h2>
        <div className={styles.links}><Button asChild variant="outline"><Link href="/settings/profile">프로필 수정</Link></Button></div>
      </section>
    </SettingsCommon>
  );
}
