'use client';

import { useAdminOtpGate } from '../../../reports/_components/admin-otp-gate/hook';
import { AdminUsersView } from '../admin-users-view/AdminUsersView';
import styles from './AdminUsersAccess.module.css';

/** Reuse A's OTP session behavior; account data is mounted only after verification. */
export function AdminUsersAccess() {
  const otp = useAdminOtpGate();
  if (otp.verified) return <AdminUsersView />;
  return (
    <section className={styles.gate} aria-labelledby="page-title">
      <h1 id="page-title">운영자 추가 인증</h1>
      <form onSubmit={otp.submit}>
        <label htmlFor="users-otp">인증 코드</label>
        <input
          id="users-otp"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={otp.code}
          onChange={(event) => otp.onCodeChange(event.target.value)}
          aria-invalid={Boolean(otp.error)}
          aria-describedby={otp.error ? 'users-otp-error' : undefined}
        />
        {otp.error && (
          <p id="users-otp-error" role="alert">
            {otp.error.message}
          </p>
        )}
        <button type="submit" disabled={otp.isPending || otp.code.length !== 6}>
          {otp.isPending ? '확인 중…' : '인증'}
        </button>
      </form>
    </section>
  );
}
