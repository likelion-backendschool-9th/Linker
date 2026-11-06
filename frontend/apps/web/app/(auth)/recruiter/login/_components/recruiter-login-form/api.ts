import { apiFetch } from '@/lib/api/api-fetch';
import { safeReturnTo } from '@/lib/auth/return-to';

export type LoginValues = { email: string; password: string };
export type LoginResponse = { restored: boolean; returnTo: string };

export function loginRecruiter(values: LoginValues, returnTo: string) {
  return apiFetch<LoginResponse>('/api/v1/public/recruiter-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: values.email.trim(),
      password: values.password,
      returnTo: safeReturnTo(returnTo),
    }),
  });
}
