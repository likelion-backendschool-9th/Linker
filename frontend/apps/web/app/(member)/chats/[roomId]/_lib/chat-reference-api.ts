import { listChatMentionCandidates } from '@linker/api/p17-chat-room/p17-chat-room';
import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import { roomKey, type ChatMember } from './room-api';

/** A mention needs a handle; the server lists only active members, so a null login is dropped. */
export type MentionCandidate = ChatMember & { login: string };
import type { ChatIssueCard } from './chat-reference-types';

export function mentionCandidatesOptions(login: string | null, roomId: number, enabled: boolean) {
  return queryOptions({
    queryKey: [...roomKey(login, roomId), 'mention-candidates'], enabled, staleTime: 0,
    queryFn: async ({ signal }) => {
      const { items } = await listChatMentionCandidates(roomId, { signal, cache: 'no-store' });
      return { items: items.filter((member): member is MentionCandidate => member.login !== null) };
    },
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
