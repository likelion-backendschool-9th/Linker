import { Bell, Search } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import type { Role } from '@/lib/auth/route-access';

import { HeaderLoginButton } from './header-login-button';
import styles from './header.module.css';

/**
 * Top bar of tab screens. Mobile/tablet: logo, then the bell (members) or "로그인" (guests).
 * Desktop adds a search field and swaps the guest login button for "설정" + "무료로 시작하기". Unread count arrives with 18.
 */
export function TabHeader({ role }: { role: Role }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/feed" className={styles.logo}>
          <Image src="/logo.svg" alt="" width={46} height={46} priority />
          <Image src="/textlogo.svg" alt="Linker" width={118} height={36} priority />
          <span className="sr-only"> 홈</span>
        </Link>
        {role === 'guest' && (
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
        )}
        <div className={styles.actions}>
          {role === 'guest' ? (
            <>
              <HeaderLoginButton label="설정" className={styles.settingsButton} />
              <HeaderLoginButton className={styles.loginButton} />
              <HeaderLoginButton label="무료로 시작하기" className={styles.ctaButton} />
            </>
          ) : (
            <Link href={'/notifications' as Route} className={styles.iconButton}>
              <Bell aria-hidden />
              <span className="sr-only">알림</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
