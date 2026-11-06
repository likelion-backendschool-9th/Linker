import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

export type SetupRepo = { id: number; name: string; fullName: string; private: boolean };
export type SetupBoard = { id: string; name: string; cardCount: number; statusColumns: string[] };

export function setupReposOptions(teamId: string) {
  return queryOptions({
    queryKey: ['team-setup', teamId, 'repos'],
    queryFn: ({ signal }) =>
      apiFetch<{ items: SetupRepo[]; notInstalledCount: number }>(
        `/api/v1/user/teams/${teamId}/setup/repos`,
        { signal },
      ),
    enabled: !!teamId,
  });
}

export function setupBoardsOptions(teamId: string) {
  return queryOptions({
    queryKey: ['team-setup', teamId, 'boards'],
    queryFn: ({ signal }) =>
      apiFetch<{ items: SetupBoard[] }>(`/api/v1/user/teams/${teamId}/setup/boards`, { signal }),
    enabled: !!teamId,
  });
}

export function setupPermissionOptions(teamId: string) {
  return queryOptions({
    queryKey: ['team-setup', teamId, 'permission-check'],
    queryFn: ({ signal }) =>
      apiFetch<{ basePermission: 'READ' | 'WRITE'; settingsUrl: string }>(
        `/api/v1/user/teams/${teamId}/setup/permission-check`,
        { signal },
      ),
    enabled: !!teamId,
  });
}
