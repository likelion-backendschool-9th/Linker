'use client';

import type { Route } from 'next';
import { useEffect, useRef, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { safeReturnTo } from '@/lib/auth/return-to';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { toast } from '@/stores/toast-store';

import styles from './LoginPromptSheet.module.css';
import { startGithubLogin } from '../start-github-login';

const OVERLAY_PARAMS = ['overlay', 'oid', 'returnTo'];

/** The screen being viewed, without overlay params: where the user comes back after login. */
function currentLocation(): string {
  const url = new URL(window.location.href);
  OVERLAY_PARAMS.forEach((param) => url.searchParams.delete(param));
  return url.pathname + url.search;
}

/**
 * Login-prompt sheet (04 POL-A-9). Mounted once in providers; opened by `useRequireLogin()`,
 * a guest hitting a login-only URL (`proxy.ts`) and API 401 LOGIN_REQUIRED.
 */
export function LoginPromptSheet() {
  const overlay = useOverlay('login');
  const [pending, setPending] = useState(false);
  const loginRequestedAt = useAppSignalStore((state) => state.loginRequestedAt);
  const { open } = overlay;
  const handledLoginAt = useRef(0);

  useEffect(() => {
    if (!loginRequestedAt || handledLoginAt.current === loginRequestedAt) return;
    handledLoginAt.current = loginRequestedAt;
    // Keep a returnTo already stored by the proxy or a tab; otherwise come back to this page.
    const existing = new URLSearchParams(window.location.search).get('returnTo');
    open(undefined, { returnTo: safeReturnTo(existing, currentLocation()) });
  }, [loginRequestedAt, open]);

  const returnTo = () => safeReturnTo(overlay.returnTo ?? currentLocation());

  async function onGithub() {
    setPending(true);
    try {
      await startGithubLogin(returnTo());
    } catch {
      toast('GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' });
    } finally {
      setPending(false);
    }
  }

  return (
    <OverlaySheet
      overlay={overlay}
      title="로그인한 사용자만 쓸 수 있는 기능이에요"
      description="로그인하면 보고 있던 화면으로 돌아와요."
    >
      <div className={styles.actions}>
        <Button block aria-disabled={pending} onClick={() => !pending && onGithub()}>
          GitHub로 시작
        </Button>
        <button
          type="button"
          className={styles.recruiter}
          onClick={() =>
            overlay.closeThen(
              `/recruiter/login?returnTo=${encodeURIComponent(returnTo())}` as Route,
            )
          }
        >
          채용 담당자 로그인
        </button>
      </div>
    </OverlaySheet>
  );
}
