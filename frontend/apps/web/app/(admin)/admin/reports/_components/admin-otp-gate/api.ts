import { apiFetch } from '@/lib/api/api-fetch';

export function verifyAdminOtp(code: string) {
  return apiFetch<{ verified: boolean }>('/api/v1/admin/otp/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
