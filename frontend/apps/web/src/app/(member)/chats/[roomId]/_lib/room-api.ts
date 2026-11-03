import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';

import { CHAT } from '@/lib/policy';
import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional WBS 17 DTOs; replace with generated Orval contracts once Spring publishes OpenAPI. */
export type ChatMember = { id: number; login: string; name: string; avatarUrl: string };
export type RoomInfo = {
  id: number;
  kind: 'TEAM' | 'DIRECT' | 'REQUEST';
  title: string;
  requestDirection: 'SENT' | 'RECEIVED' | null;
  muted: boolean;
  members: (ChatMember | null)[];
  team: {
    id: number;
    name: string;
    plan: 'FREE' | 'FLEX';
    myRole: 'OWNER' | 'ADMIN' | 'MEMBER';
    status: string;
  } | null;
  historyLimitDays: number | null;
};
export type RoomMessage = {
  id: number;
  roomId: number;
  /** Other current participants who have not read this message (server-calculated). */
  unreadCount: number;
  clientMessageId?: string;
  sender: ChatMember | null;
  type: 'TEXT' | 'IMAGE' | 'ISSUE_CARD' | 'PR_EVENT' | 'SYSTEM' | 'AI_SUMMARY' | 'SHARE_CARD';
  text: string | null;
  imageUrls: string[];
  payload: Record<string, unknown> | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  visibility?: 'VISIBLE' | 'UNDER_REVIEW' | 'HIDDEN';
};
export type MessagePage = { items: RoomMessage[]; hasMore: boolean };
export const roomKey = (login: string | null, id: number) => ['chat', login, 'room', id] as const;
export const messagesKey = (login: string | null, id: number) =>
  [...roomKey(login, id), 'messages'] as const;

export function roomInfoOptions(login: string | null, id: number) {
  return queryOptions({
    staleTime: 0,
    queryKey: [...roomKey(login, id), 'info'],
    queryFn: ({ signal }) => apiFetch<RoomInfo>(`/api/v1/user/chat-rooms/${id}`, { signal }),
  });
}
export function messagesOptions(login: string | null, id: number) {
  return infiniteQueryOptions({
    staleTime: 0,
    queryKey: messagesKey(login, id),
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal, client }) => {
      const previous = client.getQueryData<InfiniteData<MessagePage>>(messagesKey(login, id))?.pages[0];
      // A large reconnect batch also contains the last-read anchor. Refetching only
      // the default latest page on READ would discard it and move the viewport.
      if (pageParam === null && previous && previous.items.length > CHAT.catchUpMax) {
        const after = Math.max(0, previous.items[0]!.id - 1);
        const page = await apiFetch<MessagePage>(
          `/api/v1/user/chat-rooms/${id}/messages?after=${after}`, { signal },
        );
        return { ...page, hasMore: previous.hasMore };
      }
      return apiFetch<MessagePage>(
        `/api/v1/user/chat-rooms/${id}/messages${pageParam === null ? '' : `?before=${pageParam}`}`,
        { signal },
      );
    },
    getNextPageParam: (page) => (page.hasMore ? page.items[0]?.id : undefined),
  });
}
export function missedMessages(id: number, after: number) {
  return apiFetch<MessagePage>(`/api/v1/user/chat-rooms/${id}/messages?after=${after}`);
}
export function markRead(id: number, lastReadMessageId: number) {
  return apiFetch<void>(`/api/v1/user/chat-rooms/${id}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastReadMessageId }),
  });
}
export function setMuted(id: number, muted: boolean) {
  return apiFetch<void>(`/api/v1/user/chat-rooms/${id}/notification`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ muted }),
  });
}

/** Realtime delivery, REST catch-up and paginated results can overlap. */
export function orderedMessages(pages: MessagePage[]): RoomMessage[] {
  const unique = new Map<number, RoomMessage>();
  for (const page of [...pages].reverse())
    for (const message of page.items) unique.set(message.id, message);
  return [...unique.values()].sort((a, b) => a.id - b.id);
}

/** Preserve the read anchor, caught-up messages and the oldest history cursor together. */
export function mergeCatchUpHistory(
  history: InfiniteData<MessagePage> | undefined,
  incoming: MessagePage,
): InfiniteData<MessagePage> {
  return {
    pages: [{
      items: orderedMessages([incoming, ...(history?.pages ?? [])]),
      hasMore: history?.pages.at(-1)?.hasMore ?? false,
    }],
    pageParams: [null],
  };
}

export function editMessage(roomId: number, messageId: number, text: string) {
  return apiFetch<RoomMessage>(`/api/v1/user/chat-rooms/${roomId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function deleteMessage(roomId: number, messageId: number) {
  return apiFetch<void>(`/api/v1/user/chat-rooms/${roomId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export const unreadMembersKey = (login: string | null, roomId: number) =>
  [...roomKey(login, roomId), 'unread-members'] as const;

export function unreadMembersOptions(login: string | null, roomId: number, messageId: number | null) {
  return queryOptions({
    queryKey: [...unreadMembersKey(login, roomId), messageId],
    staleTime: 0,
    enabled: messageId !== null,
    queryFn: ({ signal }) => apiFetch<{ items: ChatMember[] }>(
      `/api/v1/user/chat-rooms/${roomId}/messages/${messageId}/unread-members`,
      { signal, cache: 'no-store' },
    ),
  });
}
