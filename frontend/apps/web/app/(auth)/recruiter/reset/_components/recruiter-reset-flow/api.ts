import { apiFetch } from '@/lib/api/api-fetch';

export function fetchPasswordResetTokenStatus(token: string) {
  return apiFetch<{ valid: boolean }>(
    `/api/v1/public/recruiter-auth/password-reset/${encodeURIComponent(token)}`,
  );
}

export function requestPasswordReset(email: string) {
  return apiFetch<{ sent: boolean }>('/api/v1/public/recruiter-auth/password-reset-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<void>('/api/v1/public/recruiter-auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
}
