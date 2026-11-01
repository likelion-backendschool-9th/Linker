import { Settings, UserRound } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { NotificationBell } from '@/features/notifications/notification-bell';

import type { Role } from '@/lib/auth/route-access';

import { HeaderLoginButton } from './header-login-button';
import { HeaderScrollFrame } from './header-scroll-frame';
import { HeaderSearch } from './header-search';
import styles from './header.module.css';
import { MobileSearchProvider } from './mobile-search-context';
import { MobileSearchPanel } from './mobile-search-panel';
import { MobileSearchToggle } from './mobile-search-toggle';

type TabHeaderProps = {
  role: Role;
  /** Member's GitHub login, for the desktop profile link. Null for guests. */
  login?: string | null;
  /** Shows the unread dot on the desktop 알람 button (18 NotificationController). */
  hasUnread?: boolean;
};

/**
 * Top bar of tab screens. Mobile/tablet: logo, then icon-only buttons — a search icon that reveals
 * an input row below the header, then "설정" (guests) or "알람" + profile (members). No scroll
 * animation at this size (that's desktop-only, see HeaderScrollFrame).
 * Desktop swaps the icons for a persistent search field and text pills: "설정" + "무료로 시작하기"
 * (guests) or "알람" + the profile avatar (members).
 */
export function TabHeader({ role, login = null, hasUnread = false }: TabHeaderProps) {
  return (
    <MobileSearchProvider>
      <HeaderScrollFrame>
        <Link href="/feed" className={styles.logo}>
          <Image src="/logo.svg" alt="" width={46} height={46} priority />
          <Image src="/textlogo.svg" alt="Linker" width={118} height={36} priority />
          <span className="sr-only"> 홈</span>
        </Link>
        <HeaderSearch />
        <div className={styles.actions}>
          <MobileSearchToggle />
          {role === 'guest' ? (
            <>
              <HeaderLoginButton className={`${styles.iconButton} ${styles.mobileOnly}`}>
                <Settings aria-hidden />
                <span className="sr-only">설정</span>
              </HeaderLoginButton>
              <HeaderLoginButton className={styles.softPillButton}>설정</HeaderLoginButton>
              <HeaderLoginButton className={styles.ctaButton}>무료로 시작하기</HeaderLoginButton>
            </>
          ) : (
            <>
              <NotificationBell
                compact
                initiallyUnread={hasUnread}
                className={`${styles.iconButton} ${styles.mobileOnly}`}
              />
              <Link
                href={(login ? `/u/${login}` : '/feed') as Route}
                className={`${styles.iconButton} ${styles.mobileOnly}`}
              >
                <UserRound aria-hidden />
                <span className="sr-only">내 프로필</span>
              </Link>
              <NotificationBell initiallyUnread={hasUnread} className={styles.softPillButton} />
              <Link
                href={(login ? `/u/${login}` : '/feed') as Route}
                className={styles.profileButton}
              >
                <UserRound aria-hidden />
                <span className="sr-only">내 프로필</span>
              </Link>
            </>
          )}
        </div>
      </HeaderScrollFrame>
      <MobileSearchPanel />
    </MobileSearchProvider>
  );
}
