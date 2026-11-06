'use client';

import { usePathname } from 'next/navigation';

import { MOCK_ROLE_LABELS, MOCK_ROLES } from '@/lib/auth/mock-viewer';
import { USE_MOCKS } from '@/lib/mock-mode';

import styles from './MockRoleSwitcher.module.css';

/**
 * Mock mode only (blueprint §1-2): switch the logged-in role from any screen. A full navigation through
 * `/api/mock/login/[role]` so the proxy and server components see the new cookie.
 */
export function MockRoleSwitcher() {
  const pathname = usePathname();
  if (!USE_MOCKS) return null;

  return (
    <details className={styles.root}>
      <summary className={styles.summary}>목업 계정</summary>
      <ul className={styles.list}>
        {MOCK_ROLES.map((role) => (
          <li key={role}>
            <a
              className={styles.link}
              href={`/api/mock/login/${role}?returnTo=${encodeURIComponent(pathname)}`}
            >
              {MOCK_ROLE_LABELS[role]}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
