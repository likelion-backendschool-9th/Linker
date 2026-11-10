'use client';

import { useAdminOtpGate } from '../../../reports/_components/admin-otp-gate/hook';
import { AdminAuditView } from '../admin-audit-view/AdminAuditView';
import styles from './AdminAuditAccess.module.css';

/** Reuse A's OTP session behavior; audit data is mounted only after verification. */
export function AdminAuditAccess() {
  const otp = useAdminOtpGate();
  if (otp.verified) return <AdminAuditView />;
  return (
    <section className={styles.gate} aria-labelledby="page-title">
      <h1 id="page-title">운영자 추가 인증</h1>
      <form onSubmit={otp.submit}>
        <label htmlFor="audit-otp">인증 코드</label>
        <input
          id="audit-otp"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={otp.code}
          onChange={(event) => otp.onCodeChange(event.target.value)}
          aria-invalid={Boolean(otp.error)}
          aria-describedby={otp.error ? 'audit-otp-error' : undefined}
        />
        {otp.error && (
          <p id="audit-otp-error" role="alert">
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
