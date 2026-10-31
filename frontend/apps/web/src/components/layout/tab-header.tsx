import { Bell, Search, UserRound } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import type { Role } from '@/lib/auth/route-access';

import { HeaderLoginButton } from './header-login-button';
import styles from './header.module.css';

type TabHeaderProps = {
  role: Role;
  /** Member's GitHub login, for the desktop profile link. Null for guests. */
  login?: string | null;
  /** Shows the unread dot on the desktop 알람 button (18 NotificationController). */
  hasUnread?: boolean;
};

/**
 * Top bar of tab screens. Mobile/tablet: logo, then the bell (members) or "로그인" (guests).
 * Desktop adds a search field and swaps those for "설정" + "무료로 시작하기" (guests) or "알람" + the profile
 * avatar (members).
 */
export function TabHeader({ role, login = null, hasUnread = false }: TabHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/feed" className={styles.logo}>
          <Image src="/logo.svg" alt="" width={46} height={46} priority />
          <Image src="/textlogo.svg" alt="Linker" width={118} height={36} priority />
          <span className="sr-only"> 홈</span>
        </Link>
        <div className={styles.search}>
          <Search aria-hidden className={styles.searchIcon} />
          <label htmlFor="header-search" className="sr-only">
            검색어를 입력해 주세요
          </label>
          <input
            id="header-search"
            type="search"
            placeholder="검색어를 입력해 주세요"
            className={styles.searchInput}
          />
        </div>
        <div className={styles.actions}>
          {role === 'guest' ? (
            <>
              <HeaderLoginButton label="설정" className={styles.softPillButton} />
              <HeaderLoginButton className={`${styles.loginButton} ${styles.mobileOnly}`} />
              <HeaderLoginButton label="무료로 시작하기" className={styles.ctaButton} />
            </>
          ) : (
            <>
              <Link
                href={'/notifications' as Route}
                className={`${styles.iconButton} ${styles.mobileOnly}`}
              >
                <Bell aria-hidden />
                <span className="sr-only">알림</span>
              </Link>
              <Link href={'/notifications' as Route} className={styles.softPillButton}>
                알람
                {hasUnread && (
                  <>
                    <span className={styles.unreadDot} aria-hidden />
                    <span className="sr-only"> (안 읽은 알림 있음)</span>
                  </>
                )}
              </Link>
              <Link href={(login ? `/u/${login}` : '/feed') as Route} className={styles.profileButton}>
                <UserRound aria-hidden />
                <span className="sr-only">내 프로필</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
