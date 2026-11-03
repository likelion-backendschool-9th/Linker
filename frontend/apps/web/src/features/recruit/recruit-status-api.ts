import { apiFetch } from '@/lib/api/api-fetch';

/**
 * Close / reopen / delete of WBS 20 `RecruitmentController`, borrowed by 21's author menu.
 * Here because 20 (`(developer)`) and 21 (`(public)`) are different route groups (blueprint §3-1).
 */

const recruitPath = (recruitId: string | number) =>
  `/api/v1/user/recruits/${encodeURIComponent(String(recruitId))}`;

export function closeRecruit(recruitId: string | number) {
  return apiFetch<void>(`${recruitPath(recruitId)}/close`, { method: 'POST' });
}

/** Open cap 3 (Pro 10) → 403 PLAN_LIMIT opens the shared limit sheet */
export function reopenRecruit(recruitId: string | number) {
  return apiFetch<void>(`${recruitPath(recruitId)}/reopen`, { method: 'POST' });
}

/** Pending applications become expired and applicants are notified (04 ch. 5 exceptions) */
export function deleteRecruit(recruitId: string | number) {
  return apiFetch<void>(recruitPath(recruitId), { method: 'DELETE' });
}
