'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import overlayStyles from '@/components/overlay/overlay.module.css';
import promptStyles from '@/components/overlay/prompt-dialog.module.css';
import { safeReturnTo } from '@/lib/auth/return-to';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { useAppSignalStore } from '@/stores/app-signal-store';
import { toast } from '@/stores/toast-store';

import { startGithubLogin } from '../start-github-login';

const OVERLAY_PARAMS = ['overlay', 'oid', 'returnTo'];

/** The screen being viewed, without overlay params: where the user comes back after login. */
function currentLocation(): string {
  const url = new URL(window.location.href);
  OVERLAY_PARAMS.forEach((param) => url.searchParams.delete(param));
  return url.pathname + url.search;
}

/**
 * Login-prompt modal (Figma 577:484 "21-로그인 유도" / 577:603, POL-A-9). Mounted once in
 * providers; opened by `useRequireLogin()`, a guest hitting a login-only URL, and API 401.
 */
export function LoginPromptSheet() {
  const overlay = useOverlay('login');
  const [pending, setPending] = useState(false);
  const loginRequestedAt = useAppSignalStore((state) => state.loginRequestedAt);
  const { open, close } = overlay;
  const handledLoginAt = useRef(0);

  useEffect(() => {
    if (!loginRequestedAt || handledLoginAt.current === loginRequestedAt) return;
    handledLoginAt.current = loginRequestedAt;
    const existing = new URLSearchParams(window.location.search).get('returnTo');
    open(undefined, { returnTo: safeReturnTo(existing, currentLocation()) });
  }, [loginRequestedAt, open]);

  const returnTo = () => safeReturnTo(overlay.returnTo ?? currentLocation());

  async function onLogin() {
    setPending(true);
    try {
      await startGithubLogin(returnTo());
    } catch {
      toast('GitHub에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'error' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayStyles.scrim} />
        <Dialog.Content className={promptStyles.dialog}>
          <div className={promptStyles.header}>
            <Dialog.Title className={promptStyles.title}>로그인 하기</Dialog.Title>
            <Dialog.Close type="button" className={promptStyles.close}>
              <X aria-hidden className={promptStyles.closeIcon} strokeWidth={2} />
              <span className="sr-only">닫기</span>
            </Dialog.Close>
          </div>
          <Dialog.Description className={promptStyles.description}>
            해당 기능은 로그인한 사용자들만 사용할 수 있습니다. 로그인 하시겠습니까?
          </Dialog.Description>
          <div className={promptStyles.actions}>
            <button
              type="button"
              className={promptStyles.confirm}
              aria-disabled={pending}
              onClick={() => !pending && void onLogin()}
            >
              로그인하기
            </button>
            <button type="button" className={promptStyles.cancel} onClick={() => close()}>
              취소하기
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
