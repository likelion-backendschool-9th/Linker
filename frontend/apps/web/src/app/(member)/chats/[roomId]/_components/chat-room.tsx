'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { chatKeys, unreadSummaryOptions } from '@/features/chat/chat-queries';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { CHAT } from '@/lib/policy';
import { useStompConnectionState, useStompSubscription } from '@/lib/realtime/use-stomp';

import { useMessageOutbox } from '../_hooks/use-message-outbox';
import {
  markRead,
  unreadMembersKey,
  mergeCatchUpHistory,
  mergeRoomMessage,
  messagesKey,
  messagesOptions,
  missedMessages,
  orderedMessages,
  roomInfoOptions,
  type MessagePage,
  type RoomMessage,
} from '../_lib/room-api';
import { storedSendClientId, type StoredSendEvent } from '../_lib/stored-send';
import { ChatPhotoViewer } from './chat-photo-viewer';
import { ChatComposer } from './chat-composer';
import { PendingBubble } from './pending-bubble';
import { MessageActions } from './message-actions';
import { UnreadMembersSheet } from './unread-members-sheet';
import { MessageTimeline } from './message-timeline';
import { ChatRoomMenu } from './chat-room-menu';
import { RequestRoomBar } from './request-room-bar';
import { RoomInfoSheet } from './room-info-sheet';
import { PullRequestSheet } from './pull-request-sheet';
import styles from './chat-room.module.css';

const CONNECTION = {
  idle: '연결 준비 중…',
  connecting: '연결 중…',
  connected: '연결됨',
  reconnecting: '다시 연결하는 중…',
};

export function ChatRoom({ roomId }: { roomId: number }) {
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
                items: page.items.map((item) => (item.id === message.id ? mergeRoomMessage(item, message) : item)),
              };
            }
            if (index !== 0) return page;
            return { ...page, items: [...page.items, message].sort((a, b) => a.id - b.id) };
          }),
        };
      });
      if (message.clientMessageId) outbox.acknowledge(message.clientMessageId);
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
        client.setQueryData<InfiniteData<MessagePage>>(messagesKey(viewer.login, roomId), (data) => mergeCatchUpHistory(data, page));
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
    if (!clientMessageId) return;
    outbox.acknowledge(clientMessageId);
    void client.invalidateQueries({ queryKey: messagesKey(viewer.login, roomId) });
  });
  useStompSubscription<{ event: string; message?: RoomMessage }>(
    `/topic/chat-rooms/${roomId}`,
    (event) => {
      if ((event.event === 'MESSAGE' || event.event === 'EDIT' || event.event === 'DELETE') && event.message) {
        receive(event.message);
      }
      else {
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

  if (info.isPending || history.isPending)
    return (
      <div aria-busy="true">
        <p role="status">대화를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  if (info.isError || !info.data)
    return (
      <ErrorState
        onRetry={() => {
          void info.refetch();
        }}
      />
    );
  if (history.isError && !history.data)
    return (
      <ErrorState
        onRetry={() => {
          void history.refetch();
        }}
      />
    );
  const room = info.data;
  const suspended = viewer.status === 'SUSPENDED';
  const readOnly =
    suspended ||
    room.kind === 'REQUEST' ||
    (room.team !== null && ['READ_ONLY', 'ARCHIVED'].includes(room.team.status));
  return (
    <div className={styles.room}>
      <div className={styles.toolbar}>
        <p className={styles.meta} role="status">
          {CONNECTION[connection]}
        </p>
        <ChatRoomMenu room={room} login={viewer.login} disabled={suspended} />
        <RoomInfoSheet room={room} login={viewer.login} disabled={suspended} />
        {room.team && <PullRequestSheet roomId={roomId} login={viewer.login} />}
      </div>
      {room.kind === 'REQUEST' && room.requestDirection === 'RECEIVED' && (
        <RequestRoomBar room={room} login={viewer.login} disabled={suspended} />
      )}
      {room.historyLimitDays !== null && (
        <p className={styles.notice}>
          무료 팀은 최근 {room.historyLimitDays}일 대화만 볼 수 있어요
        </p>
      )}
      {largeGap && <p role="status">안 읽은 메시지 {CHAT.catchUpMax}개+</p>}
      {catchUpError && (
        <ErrorState
          title="놓친 메시지를 불러오지 못했어요"
          onRetry={() => {
            void catchUp();
          }}
        />
      )}
      {history.isError && history.data && (
        <ErrorState
          title="대화를 갱신하지 못했어요"
          onRetry={() => {
            void history.refetch();
          }}
        />
      )}
      {history.hasNextPage && (
        <Button
          variant="soft"
          disabled={history.isFetchingNextPage}
          onClick={() => {
            void history.fetchNextPage();
          }}
        >
          {history.isFetchingNextPage ? '불러오는 중…' : '이전 대화 불러오기'}
        </Button>
      )}
      <MessageTimeline
        kind={room.kind}
        onUnread={(id) => unreadMembers.open(String(id))}
        messages={messages}
        login={viewer.login}
        readPosition={readPosition}
        onPhoto={(id, index) => photoViewer.open(`${id}:${index}`)}
        onMenu={(id) => messageMenu.open(String(id))}
        onRead={(id) => {
          if (id <= lastSeen.current || suspended) return;
          lastSeen.current = id;
          read.mutate(id);
        }}
      />
      <UnreadMembersSheet room={room} messages={messages} login={viewer.login} />
      <ChatPhotoViewer messages={messages} />
      <MessageActions room={room} messages={messages} login={viewer.login} disabled={readOnly} />
      {read.isError && (
        <div role="alert">
          <p>읽음 상태를 저장하지 못했어요.</p>
          <Button variant="soft" onClick={() => read.mutate(lastSeen.current)}>
            다시 시도
          </Button>
        </div>
      )}
      {!!pending.length && (
        <div className={styles.pendingArea} aria-label="전송 대기 목록">
          {pending.map((item) => (
            <PendingBubble
              key={item.clientMessageId}
              item={item}
              onRetry={() => {
                if (!readOnly) outbox.retry(item.clientMessageId);
              }}
              onDiscard={() => outbox.discard(item.clientMessageId)}
            />
          ))}
        </div>
      )}
      {room.kind === 'REQUEST' ? (
        room.requestDirection !== 'RECEIVED' && (
          <div className={styles.notice}>
            <p>상대가 수락하면 대화가 열려요</p>
          </div>
        )
      ) : (
        <>
          {readOnly && <p role="status">지금은 대화를 읽을 수만 있어요.</p>}
          <ChatComposer
            room={room}
            login={viewer.login}
            disabled={readOnly}
            onSend={({ text, images, references }) =>
              outbox.enqueue({
                clientMessageId: crypto.randomUUID(),
                text,
                images,
                references,
                createdAt: new Date().toISOString(),
              })
            }
          />
        </>
      )}
    </div>
  );
}
