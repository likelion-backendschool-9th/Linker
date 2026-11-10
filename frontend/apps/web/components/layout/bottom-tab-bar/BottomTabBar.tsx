'use client';

import { ChatRoundLineLinearIcon } from '@solar-icons/static/linear/chat-round-line';
import { CodeScanLinearIcon } from '@solar-icons/static/linear/code-scan';
import { HomeLinearIcon } from '@solar-icons/static/linear/home';
import { Radar2LinearIcon } from '@solar-icons/static/linear/radar-2';
import { UserCircleLinearIcon } from '@solar-icons/static/linear/user-circle';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/icon';
import { useRequireLogin } from '@/features/auth/use-require-login';
import { ChatUnreadBadge } from '@/features/chat/chat-unread-badge/ChatUnreadBadge';

import type { TabItem, TabKey } from '../bottom-tabs.config';
import styles from './BottomTabBar.module.css';

const ICONS: Record<TabKey, string> = {
  home: HomeLinearIcon,
  recruits: Radar2LinearIcon,
  workspace: CodeScanLinearIcon,
  chats: ChatRoundLineLinearIcon,
  // Profile shows the viewer's avatar; this icon is only for accounts without a photo.
  profile: UserCircleLinearIcon,
};

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The page's main-menu nav, after `main` in the DOM (blueprint §6-1). Guests' login-only tabs are
 * buttons. Icon + label; signed-in members get a 5th 프로필 tab showing the viewer's own avatar
 * instead of a Solar icon (Figma 453:258, 455:316).
 */
export function BottomTabBar({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();
  const requireLogin = useRequireLogin();

  return (
    <nav aria-label="주 메뉴" className={styles.bar}>
      <ul className={`${styles.list} ${tabs.length > 4 ? styles.listFive : ''}`}>
        {tabs.map((tab) => {
          const content = (
            <>
              <span className={styles.iconSlot}>
                {tab.avatarUrl ? (
                  <Image src={tab.avatarUrl} alt="" width={27} height={27} className={styles.avatar} />
                ) : (
                  <Icon svg={ICONS[tab.key]} className={styles.icon} />
                )}
                {tab.key === 'chats' && !tab.requiresLogin && <ChatUnreadBadge />}
              </span>
              <span className={styles.label}>{tab.label}</span>
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
