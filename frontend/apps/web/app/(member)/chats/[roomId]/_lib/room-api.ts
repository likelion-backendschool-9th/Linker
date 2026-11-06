import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';

import { CHAT } from '@/lib/policy';
import { apiFetch } from '@/lib/api/api-fetch';

import type { ChatIssueCard } from './chat-reference-types';

/** Provisional WBS 17 DTOs; replace with generated Orval contracts once Spring publishes OpenAPI. */
export type ChatMember = { id: number; login: string; name: string; avatarUrl: string | null };
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
  payload: (Record<string, unknown> & { issueCards?: ChatIssueCard[] }) | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  visibility?: 'VISIBLE' | 'UNDER_REVIEW' | 'HIDDEN';
};
export type MessagePage = {
  items: RoomMessage[];
  hasMore: boolean;
  /** `after` stopped at the 500 cap. Continue from `nextAfter`; this screen does not auto-page it. */
  catchUpLimited?: boolean;
  nextAfter?: number | null;
  /** Team history actually applied. Absent for 1:1. Flex is not granted by this field. */
  history?: { applied: 'FREE_60_DAYS'; flexSupported: false } | null;
};
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
/** `after` returns only newer ids. An edit or delete of an older message is not in that page. */
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
export function leaveRoom(id: number) {
  return apiFetch<void>(`/api/v1/user/chat-rooms/${id}/members/me`, { method: 'DELETE' });
}

export function setMuted(id: number, muted: boolean) {
  return apiFetch<void>(`/api/v1/user/chat-rooms/${id}/notification`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ muted }),
  });
}

/**
 * Microseconds since the epoch. `Date.parse` stops at milliseconds, so two edits inside one
 * millisecond would compare equal. Digits after the sixth fractional digit are ignored because
 * stored chat times stop at microseconds. An unparsable value has no order.
 */
function editedAtMicros(value: string | null): bigint | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const zone = match[8]!;
  let millis = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  if (Number.isNaN(millis)) return null;
  if (zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    millis -= sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6))) * 60_000;
  }
  return BigInt(millis) * 1000n + BigInt((match[7] ?? '').padEnd(6, '0').slice(0, 6));
}

/**
 * Live frames can arrive out of commit order. A later delete or edit wins over an older snapshot.
 * A hidden or deleted row is not replaced by text from an earlier frame.
 * Edit order uses the full microsecond `editedAt`. Two bodies with the same microsecond are not
 * ordered: the body already on screen stays.
 */
export function mergeRoomMessage(current: RoomMessage | undefined, incoming: RoomMessage): RoomMessage {
  if (!current) return incoming;
  if (current.visibility === 'HIDDEN' && incoming.visibility !== 'HIDDEN') return current;
  if (current.deletedAt && !incoming.deletedAt) return current;
  if (incoming.deletedAt) return incoming;
  const currentEdited = editedAtMicros(current.editedAt);
  const incomingEdited = editedAtMicros(incoming.editedAt);
  if (incomingEdited === null) return currentEdited === null ? incoming : current;
  if (currentEdited === null || incomingEdited > currentEdited) return incoming;
  return current;
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
