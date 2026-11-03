import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional 07 `TeamController` contract (`GET /api/v1/user/me/teams`); switch to Orval with OpenAPI. */
export type MyTeam = {
  id: number;
  name: string;
  orgAvatarUrl: string;
  status: 'ACTIVE' | 'COMPLETED' | 'READ_ONLY' | 'ARCHIVED';
  plan: 'FREE' | 'FLEX';
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  memberCount: number;
  openIssueCount: number;
  chatRoomId: number;
  unreadCount: number;
};

export type MyTeamsResponse = { items: MyTeam[]; teamLimit: number; teamCount: number };

export const teamKeys = {
  mine: ['teams', 'mine'] as const,
};

/** My teams. The team pages (11–15) read the current team's name and chat room from here. */
export function myTeamsOptions() {
  return queryOptions({
    queryKey: teamKeys.mine,
    queryFn: ({ signal }) => apiFetch<MyTeamsResponse>('/api/v1/user/me/teams', { signal }),
  });
}
