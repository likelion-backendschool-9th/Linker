'use client';

// Client boundary: marks the current tab from the pathname
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './team-frame.module.css';

const TABS = [
  { path: 'issues', label: '이슈' },
  { path: 'board', label: '보드' },
  { path: 'calendar', label: '캘린더' },
  { path: 'settings', label: '설정' },
] as const;

/** Team menu (07 TODO 4장): 이슈 / 보드 / 캘린더 / 설정 */
export function TeamNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="팀 메뉴" className={styles.nav}>
      <ul className={styles.tabs}>
        {TABS.map((tab) => {
          const href = `/teams/${teamId}/${tab.path}`;
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={tab.path} className={styles.tabItem}>
              <Link
                href={href as Route}
                aria-current={current ? 'page' : undefined}
                className={styles.tab}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
