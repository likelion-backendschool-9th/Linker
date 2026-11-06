'use client';

import type { Route } from 'next';
import Link from 'next/link';

import { useTeamNav } from './hook';
import styles from './TeamNav.module.css';

/** Team menu (07 TODO 4장): 이슈 / 보드 / 캘린더 / 설정 */
export function TeamNav({ teamId }: { teamId: string }) {
  const { tabs } = useTeamNav(teamId);
  return (
    <nav aria-label="팀 메뉴" className={styles.nav}>
      <ul className={styles.tabs}>
        {tabs.map((tab) => (
          <li key={tab.path} className={styles.tabItem}>
            <Link
              href={tab.href as Route}
              aria-current={tab.current ? 'page' : undefined}
              className={styles.tab}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
