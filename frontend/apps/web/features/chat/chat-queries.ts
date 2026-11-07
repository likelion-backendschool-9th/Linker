import type {
  ChatRoomItemResponse,
  ChatRoomPageResponse,
  UnreadSummaryResponse,
} from '@linker/api/openAPIDefinition.schemas';
import {
  acceptChatRequest as acceptChatRequestApi,
  deleteChatRequest as deleteChatRequestApi,
  listChatRooms,
  unreadChatSummary,
} from '@linker/api/p16-chat-list/p16-chat-list';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

export const CHAT_TABS = ['TEAM', 'DIRECT', 'REQUEST'] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

/** A list row. TEAM rows carry the team name in `title` and the team photo in `counterpart.avatarUrl`. */
export type ChatRoom = ChatRoomItemResponse;
export type ChatPage = ChatRoomPageResponse;
export type UnreadSummary = UnreadSummaryResponse;

export const chatKeys = {
  /** Every account's chat cache: list pages, badge summary, rooms. */
  all: ['chat'] as const,
  account: (login: string | null) => ['chat', login] as const,
};

export function chatRoomsOptions(login: string | null, tab: ChatTab) {
  return infiniteQueryOptions({
    refetchOnMount: 'always',
    queryKey: [...chatKeys.account(login), 'rooms', tab],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      listChatRooms(pageParam ? { tab, cursor: pageParam } : { tab }, { signal }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function unreadSummaryOptions(login: string | null) {
  return queryOptions({
    refetchOnMount: 'always',
    // Account-scoped so login switches and `chatKeys.account` invalidation both reach it.
    queryKey: [...chatKeys.account(login), 'unread-summary'],
    queryFn: ({ signal }) => unreadChatSummary({ signal }),
  });
}

export function acceptChatRequest(roomId: number) {
  return acceptChatRequestApi(roomId);
}

export function deleteChatRequest(roomId: number) {
  return deleteChatRequestApi(roomId);
}
