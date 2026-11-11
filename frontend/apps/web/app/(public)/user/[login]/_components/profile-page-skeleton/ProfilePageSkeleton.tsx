'use client';

import { SettingsLinearIcon } from '@solar-icons/static/linear/settings';
import Link from 'next/link';

import { Icon } from '@/components/ui/icon';
import { useLoaderPresence } from '@/components/ui/page-loading';

import styles from './ProfilePageSkeleton.module.css';

/** Figma 982:366 "4-스켈레톤" — own-profile loading body (header/tabs come from PageFrame). */
export function ProfilePageSkeleton() {
  useLoaderPresence();

  return (
    <div className={styles.stage} aria-busy="true">
      <p className="sr-only" role="status">
        불러오는 중이에요
      </p>
      <div className={styles.identityRow} aria-hidden>
        <span className={styles.avatar} />
        <div className={styles.identityText}>
          <span className={`${styles.bone} ${styles.name}`} />
          <span className={`${styles.bone} ${styles.meta}`} />
        </div>
        <Link className={styles.settings} href="/settings/profile" aria-label="프로필 수정">
          <Icon svg={SettingsLinearIcon} />
        </Link>
      </div>
      <span className={`${styles.bone} ${styles.bio}`} aria-hidden />
    </div>
  );
}
