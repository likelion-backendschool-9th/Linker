'use client';

import { useRequireLogin } from '@/features/auth/use-require-login';

import styles from './header.module.css';

type HeaderLoginButtonProps = {
  /** Defaults to the mobile/tablet "로그인" label; desktop passes "설정" or "무료로 시작하기" */
  label?: string;
  className?: string;
};

/** Guests see this in place of the notification bell (04 POL-A-9); desktop renders it twice more for 설정/CTA. */
export function HeaderLoginButton({ label = '로그인', className }: HeaderLoginButtonProps) {
  const requireLogin = useRequireLogin();
  return (
    <button type="button" className={className ?? styles.loginButton} onClick={() => requireLogin()}>
      {label}
    </button>
  );
}
