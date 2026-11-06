import { apiFetch } from '@/lib/api/api-fetch';

export type ProfileTeam = {
  id: number;
  name: string;
  orgAvatarUrl: string | null;
  status: 'ACTIVE' | 'COMPLETED';
};

export function fetchProfileTeams(login: string) {
  return apiFetch<{ items: ProfileTeam[] }>(
    `/api/v1/public/users/${encodeURIComponent(login)}/teams`,
  );
}
