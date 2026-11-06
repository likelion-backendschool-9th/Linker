import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import { roomKey, type ChatMember } from './room-api';
import type { ChatIssueCard } from './chat-reference-types';

export function mentionCandidatesOptions(login: string | null, roomId: number, enabled: boolean) {
  return queryOptions({
    queryKey: [...roomKey(login, roomId), 'mention-candidates'], enabled, staleTime: 0,
    queryFn: ({ signal }) => apiFetch<{ items: ChatMember[] }>(`/api/v1/user/chat-rooms/${roomId}/mention-candidates`, { signal, cache: 'no-store' }),
  });
}
export function chatReposOptions(login: string | null, teamId: number | null, enabled: boolean) {
  return queryOptions({
    queryKey: ['chat', login, 'team-repos', teamId], enabled, staleTime: 0,
    queryFn: ({ signal }) => apiFetch<{ repos: { id: number; name: string }[] }>(`/api/v1/user/teams/${teamId}/issue-filters`, { signal, cache: 'no-store' }),
  });
}
export function issueCardOptions(login: string | null, roomId: number, number: number, repoId: number | null, enabled: boolean) {
  return queryOptions({
    queryKey: [...roomKey(login, roomId), 'issue-card', number, repoId], enabled, staleTime: 0,
    queryFn: ({ signal }) => apiFetch<ChatIssueCard>(`/api/v1/user/chat-rooms/${roomId}/issue-cards?number=${number}&repoId=${repoId}`, { signal, cache: 'no-store' }),
  });
}
