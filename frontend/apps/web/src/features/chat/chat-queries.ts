import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

export const CHAT_TABS = ['TEAM', 'DIRECT', 'REQUEST'] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

/** Provisional WBS 16 contract; replace with Orval types when OpenAPI is available. */
export type ChatRoom = {
  id: number;
  kind: ChatTab;
  title: string;
  counterpart: { avatarUrl: string | null } | null;
  requestKind: 'NORMAL' | 'RECRUITING' | null;
  requestDirection: 'SENT' | 'RECEIVED' | null;
  companyName: string | null;
  muted: boolean;
  unreadCount: number;
  lastMessage: { text: string; createdAt: string } | null;
};
export type ChatPage = { items: ChatRoom[]; nextCursor: string | null };
export type UnreadSummary = Record<ChatTab, number> & { requestCount: number; total: number };

export const chatKeys = {
  account: (login: string | null) => ['chat', login] as const,
};

export function chatRoomsOptions(login: string | null, tab: ChatTab) {
  return infiniteQueryOptions({
    refetchOnMount: 'always',
    queryKey: [...chatKeys.account(login), 'rooms', tab],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ tab });
      if (pageParam) query.set('cursor', pageParam);
      return apiFetch<ChatPage>(`/api/v1/user/chat-rooms?${query}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function unreadSummaryOptions(login: string | null) {
  return queryOptions({
    refetchOnMount: 'always',
    queryKey: [...chatKeys.account(login), 'unread-summary'],
    queryFn: ({ signal }) =>
      apiFetch<UnreadSummary>('/api/v1/user/chat-rooms/unread-summary', { signal }),
  });
}

export function acceptChatRequest(roomId: number) {
  return apiFetch<{ roomId: number }>(`/api/v1/user/chat-requests/${roomId}/accept`, {
    method: 'POST',
  });
}

export function deleteChatRequest(roomId: number) {
  return apiFetch<void>(`/api/v1/user/chat-requests/${roomId}`, { method: 'DELETE' });
}
