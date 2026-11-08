'use client';

import { useRouter } from 'next/navigation';
import { AUTH_REDIRECT_URL } from '@linker/bridge';
import type { Route } from 'next';
import { useEffect, useRef, useState } from 'react';

import { SkipLink } from '@/components/layout/skip-link/SkipLink';
import { saveNativeSession } from '@/features/auth/sync-native-session';
import { useAccountSessionRefresh } from '@/features/auth/use-account-session-refresh';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { safeReturnTo } from '@/lib/auth/return-to';
import { isInApp } from '@/lib/bridge/native';
import { toast } from '@/stores/toast-store';

import styles from './callback-flow.module.css';

type CallbackResult = { isNew: boolean; restored: boolean; returnTo: string };

export function CallbackFlow({
  code,
  state,
  returnTo,
  errorCode,
  client = 'web',
}: {
  code: string;
  state: string;
  returnTo: string;
  errorCode: string;
  client?: string;
}) {
  const router = useRouter();
  const refreshSession = useAccountSessionRefresh();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const callbackRequest = useRef<Promise<CallbackResult> | null>(null);

  useEffect(() => {
    let active = true;

    async function completeLogin() {
      // The system browser hands the code back. Only the WebView exchanges it and receives the cookie.
      if (client === 'app' && !isInApp() && state && (code || errorCode)) {
        const url = new URL(AUTH_REDIRECT_URL);
        url.searchParams.set('state', state);
        if (code) url.searchParams.set('code', code);
        if (errorCode) url.searchParams.set('error', errorCode);
        url.searchParams.set('returnTo', safeReturnTo(returnTo));
        window.location.replace(url.toString());
        return;
      }
      if (errorCode || !code || !state) {
        setError('로그인을 완료하지 못했어요. 다시 시도해 주세요.');
        setPending(false);
        return;
      }

      try {
        callbackRequest.current ??= apiFetch<CallbackResult>(
          '/api/v1/public/auth/github/callback',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state, returnTo: safeReturnTo(returnTo) }),
          },
        );
        const result = await callbackRequest.current;
        if (!active) return;
        if (result.restored) toast('계정을 복구했어요.');
        try {
          await saveNativeSession();
        } catch {
          // Web login still succeeds if the native session sync fails.
        }
        refreshSession();
        router.replace((result.isNew ? '/onboarding' : safeReturnTo(result.returnTo)) as Route);
      } catch (cause) {
        if (!active) return;
        const message =
          cause instanceof ApiError
            ? cause.message
            : '로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';
        setError(message);
        setPending(false);
      }
    }

    void completeLogin();
    return () => {
      active = false;
    };
  }, [client, code, errorCode, refreshSession, returnTo, router, state]);

  return (
    <>
      <SkipLink />
      <main
        id="main"
        tabIndex={-1}
        className={styles.main}
        aria-labelledby="callback-title"
        aria-live="polite"
      >
        <div className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {pending ? (
          <>
            <h1 id="callback-title" className="sr-only">
              로그인을 확인하고 있어요
            </h1>
            <p className="sr-only" role="status">
              잠시만 기다려 주세요.
            </p>
          </>
        ) : (
          <div className={styles.failure}>
            <h1 id="callback-title" className={styles.title}>
              로그인할 수 없어요
            </h1>
            <p className={styles.error} role="alert">
              {error}
            </p>
            <button type="button" className={styles.retry} onClick={() => router.replace('/')}>
              다시 시도
            </button>
          </div>
        )}
      </main>
    </>
  );
}
