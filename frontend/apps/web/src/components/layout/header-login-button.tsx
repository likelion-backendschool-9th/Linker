'use client';

import type { ReactNode } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';

type HeaderLoginButtonProps = {
  /** "설정" / "무료로 시작하기" text (desktop) or an icon + sr-only label (mobile 설정) */
  children: ReactNode;
  className?: string;
};

/** Guest-only header actions that open the login sheet (04 POL-A-9). */
export function HeaderLoginButton({ children, className }: HeaderLoginButtonProps) {
  const requireLogin = useRequireLogin();
  return (
    <button type="button" className={className} onClick={() => requireLogin()}>
      {children}
    </button>
  );
}
