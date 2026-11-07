'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { CHAT } from '@/lib/policy';
import { useStompConnectionState, useStompSubscription } from '@/lib/realtime/use-stomp';

import { useMessageOutbox } from '../../_hooks/use-message-outbox';
import { messagePayload } from '@/features/share/chat-cards';

import {
  chatKeys,
  markRead,
  mergeCatchUpHistory,
  mergeRoomMessage,
  messagesKey,
  messagesOptions,
  missedMessages,
  orderedMessages,
  rejectedSend,
  roomInfoOptions,
  storedSendClientId,
  unreadMembersKey,
  unreadSummaryOptions,
  type MessagePage,
  type RoomMessage,
  type StoredSendEvent,
} from './api';

export const CONNECTION = {
  idle: '연결 준비 중…',
  connecting: '연결 중…',
  connected: '연결됨',
  reconnecting: '다시 연결하는 중…',
} as const;

export function useChatRoom(roomId: number) {
  const viewer = useViewer();
  const messageMenu = useOverlay('chat-message');
  const photoViewer = useOverlay('chat-photo');
  const unreadMembers = useOverlay('chat-unread');
  const client = useQueryClient();
  const info = useQuery(roomInfoOptions(viewer.login, roomId));
  const history = useInfiniteQuery(messagesOptions(viewer.login, roomId));
  const messages = useMemo(() => orderedMessages(history.data?.pages ?? []), [history.data]);
  const { outbox, pending } = useMessageOutbox(roomId, viewer.login);
  const connection = useStompConnectionState();
  const latest = useRef(0);
  const lastSeen = useRef(0);
  const [catchUpError, setCatchUpError] = useState(false);
  const [largeGap, setLargeGap] = useState(false);
  const [readPosition, setReadPosition] = useState<{ id: number } | null>(null);
  const read = useMutation({
    scope: { id: `chat-read:${viewer.login}:${roomId}` },
    mutationFn: (id: number) => markRead(roomId, id),
    retry: 1,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: messagesKey(viewer.login, roomId) }),
        client.invalidateQueries({ queryKey: unreadMembersKey(viewer.login, roomId) }),
        client.invalidateQueries({ queryKey: unreadSummaryOptions(viewer.login).queryKey }),
        client.invalidateQueries({ queryKey: [...chatKeys.account(viewer.login), 'rooms'] }),
      ]);
    },
  });
  useEffect(() => {
    latest.current = messages.at(-1)?.id ?? 0;
    for (const message of messages)
      if (message.clientMessageId) outbox.acknowledge(message.clientMessageId);
  }, [messages, outbox]);

  const receive = useCallback(
    (message: RoomMessage) => {
      if (message.roomId !== roomId) return;
      client.setQueryData<InfiniteData<MessagePage>>(messagesKey(viewer.login, roomId), (data) => {
        if (!data?.pages.length) return data;
        const found = data.pages.some((page) => page.items.some((item) => item.id === message.id));
        return {
          ...data,
          pages: data.pages.map((page, index) => {
            if (found) {
              return {
                ...page,
                items: page.items.map((item) =>
                  item.id === message.id ? mergeRoomMessage(item, message) : item,
                ),
              };
            }
            if (index !== 0) return page;
            return { ...page, items: [...page.items, message].sort((a, b) => a.id - b.id) };
          }),
        };
      });
      if (message.clientMessageId) outbox.acknowledge(message.clientMessageId);
      // SHARE_CARD live frames contain only a target reference. REST resolves visibility per reader.
      if (message.type === 'SHARE_CARD' || messagePayload(message.payload)?.linkerCard) {
        void client.invalidateQueries({ queryKey: messagesKey(viewer.login, roomId) });
      }
    },
    [client, roomId, viewer.login, outbox],
  );
  const catchUp = useCallback(async () => {
    try {
      const position = lastSeen.current || latest.current;
      const page = await missedMessages(roomId, latest.current);
      if (page.catchUpLimited || page.items.length > CHAT.catchUpMax) {
        setLargeGap(true);
        // Keep the cached read position and every returned message: truncating here
        // loses the anchor and creates a gap that older-page pagination cannot fill.
        client.setQueryData<InfiniteData<MessagePage>>(messagesKey(viewer.login, roomId), (data) =>
          mergeCatchUpHistory(data, page),
        );
        setReadPosition({ id: position || page.items[0]!.id });
      } else page.items.forEach(receive);
      setCatchUpError(false);
    } catch {
      setCatchUpError(true);
    }
  }, [client, roomId, viewer.login, receive]);
  const initialSync = useRef(false);
  useEffect(() => {
    if (connection === 'connected' && !initialSync.current) {
      initialSync.current = true;
      void catchUp();
    }
  }, [connection, catchUp]);
  useStompSubscription<StoredSendEvent>('/user/queue/chat-rooms', (event) => {
    const clientMessageId = storedSendClientId(event, roomId);
    if (clientMessageId) {
      outbox.acknowledge(clientMessageId);
      void client.invalidateQueries({ queryKey: messagesKey(viewer.login, roomId) });
      return;
    }
    const rejected = rejectedSend(event, roomId);
    if (!rejected) return;
    outbox.reject(rejected.clientMessageId, rejected.retryable);
  });
  useStompSubscription<{ event: string; message?: RoomMessage }>(
    `/topic/chat-rooms/${roomId}`,
    (event) => {
      if (
        (event.event === 'MESSAGE' || event.event === 'EDIT' || event.event === 'DELETE') &&
        event.message
      ) {
        receive(event.message);
      } else {
        void client.invalidateQueries({ queryKey: messagesKey(viewer.login, roomId) });
        void client.invalidateQueries({ queryKey: unreadMembersKey(viewer.login, roomId) });
      }
    },
    {
      onResubscribe: () => {
        void catchUp();
      },
    },
  );

  const room = info.data;
  const suspended = viewer.status === 'SUSPENDED';
  const readOnly =
    !!room &&
    (suspended ||
      room.kind === 'REQUEST' ||
      (room.team !== null && ['READ_ONLY', 'ARCHIVED'].includes(room.team.status)));

  function markMessageRead(id: number) {
    if (id <= lastSeen.current || suspended) return;
    lastSeen.current = id;
    read.mutate(id);
  }

  function retryReadMark() {
    read.mutate(lastSeen.current);
  }

  return {
    roomId,
    viewer,
    messageMenu,
    photoViewer,
    unreadMembers,
    info,
    history,
    messages,
    outbox,
    pending,
    connection,
    catchUpError,
    largeGap,
    readPosition,
    read,
    catchUp,
    markMessageRead,
    retryReadMark,
    suspended,
    readOnly,
    room,
  };
}
