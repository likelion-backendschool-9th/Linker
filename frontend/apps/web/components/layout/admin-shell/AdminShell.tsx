import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './AdminShell.module.css';
import { SkipLink } from '../skip-link';

const ADMIN_MENU = [
  { href: '/admin/reports', label: '신고 처리' },
  { href: '/admin/users', label: '회원 관리' },
  { href: '/admin/audit', label: '조치 기록' },
] as const;

/**
 * (admin) frame (blueprint §6-1): header + `nav "운영 메뉴"` + `main`. Pages render their h1 with
 * `id="page-title"` and, for list + detail, an `aside aria-label="신고 상세"` (two columns from 1024px).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <SkipLink />
      <header className={styles.header}>
        <Link href="/feed" className={styles.brand}>
          Linker 운영
        </Link>
      </header>
      <nav aria-label="운영 메뉴" className={styles.nav}>
        <ul className={styles.menu}>
          {ADMIN_MENU.map((item) => (
            <li key={item.href}>
              <Link href={item.href as Route} className={styles.menuLink}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" tabIndex={-1} aria-labelledby="page-title" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
