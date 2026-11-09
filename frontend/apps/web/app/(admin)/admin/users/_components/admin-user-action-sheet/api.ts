import { apiFetch } from '@/lib/api/api-fetch';
export { adminUserOptions, type AdminUserDetail } from '../../_lib/admin-user-queries';
export type ActionDraft = { userId: string; step: string; reason: string };
export function sanctionUser(userId: string, step: string, reason: string) {
  return apiFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ step, reason: reason.trim(), reasonCode: 'OTHER' }),
  });
}
export function revealEmail(userId: string, reason: string) {
  return apiFetch<{ email: string | null }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/email-reveal`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
      cache: 'no-store',
    },
  );
}
export function liftSanction(userId: string, sanctionId: string) {
  return apiFetch(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions/${encodeURIComponent(sanctionId)}`,
    { method: 'DELETE' },
  );
}
