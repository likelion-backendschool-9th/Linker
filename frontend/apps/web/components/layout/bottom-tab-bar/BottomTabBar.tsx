'use client';

import { Briefcase, House, MessageCircle, UsersRound } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { ChatUnreadBadge } from '@/features/chat/chat-unread-badge/ChatUnreadBadge';

import type { TabItem, TabKey } from '../bottom-tabs.config';
import styles from './BottomTabBar.module.css';

const ICONS: Record<TabKey, typeof House> = {
  home: House,
  recruits: UsersRound,
  workspace: Briefcase,
  chats: MessageCircle,
};

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The page's main-menu nav, after `main` in the DOM (blueprint §6-1). Guests' login-only tabs are
 * buttons. Mobile: icon + label. Tablet/desktop: a floating text-only pill, no icons (profile now
 * lives in the top header on every size, so it isn't one of these tabs).
 */
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
              <Icon aria-hidden className={styles.icon} />
              <span className={styles.label}>
                {tab.label}
                {tab.key === 'chats' && !tab.requiresLogin && <ChatUnreadBadge />}
              </span>
            </>
          );
          return (
            <li key={tab.key} className={styles.item}>
              {tab.requiresLogin ? (
                <button type="button" className={styles.tab} onClick={() => requireLogin(tab.href)}>
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
