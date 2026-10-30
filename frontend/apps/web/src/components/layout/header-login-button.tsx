'use client';

import { useRequireLogin } from '@/features/auth/use-require-login';

import styles from './header.module.css';

/** Guests see "로그인" in place of the notification bell (04 POL-A-9). */
export function HeaderLoginButton() {
  const requireLogin = useRequireLogin();
  return (
    <button type="button" className={styles.loginButton} onClick={() => requireLogin()}>
      로그인
    </button>
  );
}
