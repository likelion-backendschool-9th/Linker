import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BottomTabBar } from '@/components/layout/bottom-tab-bar';
import { tabsFor } from '@/components/layout/bottom-tabs.config';
import { HeaderChrome } from '@/components/layout/header-chrome';
import { MobileSearchProvider } from '@/components/layout/mobile-search-context';
import { MobileSearchPanel } from '@/components/layout/mobile-search-panel';
import { MobileSearchToggle } from '@/components/layout/mobile-search-toggle';
import { SkipLink } from '@/components/layout/skip-link';
import { NotificationBell } from '@/features/notifications/notification-bell/NotificationBell';
import { hasUnreadNotifications } from '@/features/notifications/get-unread';
import { StatusBanners } from '@/features/status-banner/status-banners/StatusBanners';
import { getSession, viewerFromSession } from '@/lib/auth/session';

import { getPublicProfile } from '../../../../(public)/user/[login]/_lib/get-profile';
import styles from './WorkspaceFrame.module.css';

/** Approved page-07 variant: profile in the header, four tabs. Shared chrome stays unchanged. */
export async function WorkspaceFrame({ children }: { children: ReactNode }) {
  const session = await getSession();
  const { role } = viewerFromSession(session);
  const [hasUnread, avatarUrl] = await Promise.all([
    session ? hasUnreadNotifications() : false,
    session
      ? getPublicProfile(session.login)
          .then((profile) => profile.avatarUrl)
          .catch(() => null)
      : null,
  ]);
  const tabs = tabsFor(role).filter((tab) => tab.key !== 'profile');

  return (
    <div className={styles.frame}>
      <SkipLink />
      <MobileSearchProvider>
        <HeaderChrome>
          <header className={styles.header}>
            <Link href="/feed" className={styles.logo}>
              <Image
                src="/images/workspace/logo.svg"
                alt="Linker 홈"
                width={108}
                height={32}
                priority
              />
            </Link>
            <div className={styles.actions}>
              <span className={styles.search}>
                <MobileSearchToggle />
              </span>
              <NotificationBell initiallyUnread={hasUnread} className={styles.iconButton} />
              {session && (
                <Link
                  href={`/user/${encodeURIComponent(session.login)}` as Route}
                  className={styles.profile}
                >
                  {avatarUrl && (
                    <Image
                      src={avatarUrl}
                      alt=""
                      width={25}
                      height={25}
                      sizes="25px"
                      className={styles.avatar}
                    />
                  )}
                  <span className="sr-only">내 프로필</span>
                </Link>
              )}
            </div>
          </header>
          <MobileSearchPanel />
        </HeaderChrome>
      </MobileSearchProvider>
      <main id="main" tabIndex={-1} aria-labelledby="page-title" className={styles.main}>
        <h1 id="page-title" className="sr-only">
          워크스페이스
        </h1>
        <StatusBanners />
        {children}
      </main>
      <div className={styles.bottomTabs}>
        <BottomTabBar tabs={tabs} />
      </div>
    </div>
  );
}
