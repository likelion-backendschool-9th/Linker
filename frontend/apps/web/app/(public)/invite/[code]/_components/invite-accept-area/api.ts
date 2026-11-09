import { apiFetch } from '@/lib/api/api-fetch';

export type AcceptInviteResult = {
  teamId: number;
  orgLogin: string;
  needsGithubInvite: boolean;
};

/** POST /api/v1/user/invites/{code}/accept — TeamController (WBS P10) */
export function acceptInvite(code: string) {
  return apiFetch<AcceptInviteResult>(`/api/v1/user/invites/${encodeURIComponent(code)}/accept`, {
    method: 'POST',
  });
}
