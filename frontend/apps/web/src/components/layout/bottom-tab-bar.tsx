'use client';

import { Briefcase, House, MessageCircle, UserRound, UsersRound } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useRequireLogin } from '@/features/auth/use-require-login';

import type { TabItem, TabKey } from './bottom-tabs.config';
import styles from './bottom-tab-bar.module.css';

const ICONS: Record<TabKey, typeof House> = {
  home: House,
  recruits: UsersRound,
  workspace: Briefcase,
  chats: MessageCircle,
  profile: UserRound,
};

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The page's main-menu nav, after `main` in the DOM (blueprint §6-1). Guests' login-only tabs are buttons. */
export function BottomTabBar({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();
  const requireLogin = useRequireLogin();

  return (
    <nav aria-label="주 메뉴" className={styles.bar}>
      <ul className={styles.list}>
        {tabs.map((tab) => {
          const Icon = ICONS[tab.key];
          const content = (
            <>
              <Icon aria-hidden />
              <span className={styles.label}>{tab.label}</span>
            </>
          );
          return (
            <li key={tab.key} className={styles.item}>
              {tab.requiresLogin ? (
                <button
                  type="button"
                  className={styles.tab}
                  onClick={() => requireLogin(tab.key === 'profile' ? undefined : tab.href)}
                >
                  {content}
                </button>
              ) : (
                <Link
                  href={tab.href as Route}
                  className={styles.tab}
                  aria-current={isCurrent(pathname, tab.href) ? 'page' : undefined}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
