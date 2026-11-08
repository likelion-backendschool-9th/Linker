import type {
  ChatMemberResponse,
  ChatMessagePageResponse,
  ChatMessageResponse,
  ChatRoomInfoResponse,
} from '@linker/api/openAPIDefinition.schemas';
import {
  deleteChatMessage,
  editChatMessage,
  getChatRoom,
  leaveChatRoom,
  listChatMessages,
  listUnreadChatMembers,
  markChatRead,
  updateChatNotification,
} from '@linker/api/p17-chat-room/p17-chat-room';
import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';

import { CHAT } from '@/lib/policy';

export type ChatMember = ChatMemberResponse;
/** `team` carries the caller's `myRole`; it drives other-message delete and @all. */
export type RoomInfo = ChatRoomInfoResponse;
/** `updatedAt` is the row version: every edit, delete, hide and restore moves it forward. */
export type RoomMessage = ChatMessageResponse;
/** `nextAfter` is set when `after` stopped at the 500 cap; `loadAfter` follows it to the end. */
export type MessagePage = Pick<ChatMessagePageResponse, 'items' | 'hasMore'> &
  Partial<Omit<ChatMessagePageResponse, 'items' | 'hasMore'>>;

export const roomKey = (login: string | null, id: number) => ['chat', login, 'room', id] as const;
export const messagesKey = (login: string | null, id: number) =>
  [...roomKey(login, id), 'messages'] as const;

export function roomInfoOptions(login: string | null, id: number) {
  return queryOptions({
    staleTime: 0,
    queryKey: [...roomKey(login, id), 'info'],
    queryFn: ({ signal }) => getChatRoom(id, { signal }),
  });
}

/**
 * Every message newer than `after`, following `nextAfter` past the server's 500 cap (Policy: load
 * everything at once). `catchUpLimited` stays true when any batch was capped, so the screen can show
 * the 500+ notice. `after` must be a message id in this room.
 */
export async function loadAfter(id: number, after: number, signal?: AbortSignal): Promise<MessagePage> {
  const items: RoomMessage[] = [];
  let cursor = after;
  let limited = false;
  for (;;) {
    const page = await listChatMessages(id, { after: cursor }, { signal });
    items.push(...page.items);
    if (!page.catchUpLimited) break;
    limited = true;
    const next = page.nextAfter ?? page.items.at(-1)?.id;
    if (next === undefined || next <= cursor) break;
    cursor = next;
  }
  return { items, hasMore: false, catchUpLimited: limited, nextAfter: null };
}

export function messagesOptions(login: string | null, id: number) {
  return infiniteQueryOptions({
    staleTime: 0,
    queryKey: messagesKey(login, id),
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal, client }): Promise<MessagePage> => {
      const previous = client.getQueryData<InfiniteData<MessagePage>>(messagesKey(login, id))?.pages[0];
      // A large reconnect batch also contains the last-read anchor. Refetching only
      // the default latest page on READ would discard it and move the viewport.
      if (pageParam === null && previous && previous.items.length > CHAT.catchUpMax) {
        const [anchor] = previous.items;
        // `after` must name a message in this room, so the anchor itself is kept from the cache.
        const page = await loadAfter(id, anchor!.id, signal);
        return { ...page, items: [anchor!, ...page.items], hasMore: previous.hasMore };
      }
      return listChatMessages(id, pageParam === null ? undefined : { before: pageParam }, { signal });
    },
    getNextPageParam: (page) => (page.hasMore ? page.items[0]?.id : undefined),
  });
}
/** `after` returns only newer ids. An edit or delete of an older message is not in that page. */
export function missedMessages(id: number, after: number) {
  return loadAfter(id, after);
}
export function markRead(id: number, lastReadMessageId: number) {
  return markChatRead(id, { lastReadMessageId });
}
export function leaveRoom(id: number) {
  return leaveChatRoom(id);
}

export function setMuted(id: number, muted: boolean) {
  return updateChatNotification(id, { muted });
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
 * Live frames can arrive out of commit order. The row with the later `updatedAt` wins, so a
 * restore after a hide or an operator undelete reaches an open screen, while a delayed older
 * frame does not undo a newer state. Equal versions keep what is on screen.
 * Rows without `updatedAt` (an older server) fall back to direction rules: a hidden or deleted row
 * is not replaced by an earlier frame's text, and edits compare the full microsecond `editedAt`.
 */
export function mergeRoomMessage(current: RoomMessage | undefined, incoming: RoomMessage): RoomMessage {
  if (!current) return incoming;
  const currentVersion = editedAtMicros(current.updatedAt ?? null);
  const incomingVersion = editedAtMicros(incoming.updatedAt ?? null);
  if (currentVersion !== null && incomingVersion !== null)
    return incomingVersion > currentVersion ? incoming : current;
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
    for (const message of page.items) unique.set(message.id, mergeRoomMessage(unique.get(message.id), message));
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
  return editChatMessage(roomId, messageId, { text });
}

export function deleteMessage(roomId: number, messageId: number) {
  return deleteChatMessage(roomId, messageId);
}

export const unreadMembersKey = (login: string | null, roomId: number) =>
  [...roomKey(login, roomId), 'unread-members'] as const;

export function unreadMembersOptions(login: string | null, roomId: number, messageId: number | null) {
  return queryOptions({
    queryKey: [...unreadMembersKey(login, roomId), messageId],
    staleTime: 0,
    enabled: messageId !== null,
    queryFn: ({ signal }) => listUnreadChatMembers(roomId, messageId!, { signal, cache: 'no-store' }),
  });
}
