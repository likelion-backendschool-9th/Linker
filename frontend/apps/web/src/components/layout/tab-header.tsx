import { Bell } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import type { Role } from '@/lib/auth/route-access';

import { HeaderLoginButton } from './header-login-button';
import styles from './header.module.css';

/** Top bar of tab screens: logo, then the bell (members) or "로그인" (guests). Unread count arrives with 18. */
export function TabHeader({ role }: { role: Role }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/feed" className={styles.logo}>
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
          <span>Linker</span>
          <span className="sr-only"> 홈</span>
        </Link>
        <div className={styles.actions}>
          {role === 'guest' ? (
            <HeaderLoginButton />
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
