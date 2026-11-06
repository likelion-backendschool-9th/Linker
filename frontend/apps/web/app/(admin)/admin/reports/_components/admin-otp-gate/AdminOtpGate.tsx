'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button/Button';

import { useAdminOtpGate } from './hook';
import styles from '../admin-reports.module.css';

export function AdminOtpGate({ children }: { children: ReactNode }) {
  const { verified, code, onCodeChange, submit, isPending, error } = useAdminOtpGate();

  if (verified) return children;

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
          onChange={(event) => onCodeChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'admin-otp-error' : undefined}
        />
        {error && (
          <p className={styles.formError} id="admin-otp-error" role="alert">
            {error instanceof Error ? error.message : '인증 코드를 확인해 주세요.'}
          </p>
        )}
        <Button type="submit" disabled={isPending || code.length !== 6}>
          {isPending ? '확인 중…' : '인증하고 신고 보기'}
        </Button>
      </form>
      <p className={styles.otpNote}>
        인증을 마치기 전에는 신고 목록 및 상세 정보를 요청하지 않아요.
      </p>
    </section>
  );
}
