'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/api-fetch';
import { ADMIN } from '@/lib/policy';

import styles from './admin-reports.module.css';

const OTP_IDLE_MS = ADMIN.otpIdleMinutes * 60 * 1000;

export function AdminOtpGate({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState('');
  const verify = useMutation({
    mutationFn: () => apiFetch<{ verified: boolean }>('/api/v1/admin/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    }),
    onSuccess: (result) => setVerified(result.verified),
  });

  useEffect(() => {
    if (!verified) return;
    let timer: ReturnType<typeof setTimeout>;
    const lockAfterIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVerified(false), OTP_IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    lockAfterIdle();
    events.forEach((event) => window.addEventListener(event, lockAfterIdle, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, lockAfterIdle));
    };
  }, [verified]);

  if (verified) return children;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verify.isPending) verify.mutate();
  }

  return (
    <section className={styles.otpPage} aria-labelledby="page-title">
      <h1 id="page-title">운영자 추가 인증</h1>
      <p>신고 관리에 접근하려면 OTP 인증이 필요해요.</p>
      <form className={styles.otpForm} onSubmit={submit}>
        <label htmlFor="admin-otp">인증 코드</label>
        <input
          id="admin-otp"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={Boolean(verify.error)}
          aria-describedby={verify.error ? 'admin-otp-error' : undefined}
        />
        {verify.error && (
          <p className={styles.formError} id="admin-otp-error" role="alert">
            {verify.error instanceof Error ? verify.error.message : '인증 코드를 확인해 주세요.'}
          </p>
        )}
        <Button
          type="submit"
          disabled={verify.isPending || code.length !== 6}
          pending={verify.isPending}
          pendingLabel="확인 중…"
        >
          인증하고 신고 보기
        </Button>
      </form>
      <p className={styles.otpNote}>
        인증을 마치기 전에는 신고 목록 및 상세 정보를 요청하지 않아요.
      </p>
    </section>
  );
}
