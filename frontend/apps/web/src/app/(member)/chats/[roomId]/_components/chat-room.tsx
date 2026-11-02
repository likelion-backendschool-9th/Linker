'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { chatKeys, unreadSummaryOptions } from '@/features/chat/chat-queries';
import { useViewer } from '@/lib/auth/viewer-context';
import { CHAT } from '@/lib/policy';
import { useStompConnectionState, useStompSubscription } from '@/lib/realtime/use-stomp';

import { useMessageOutbox } from '../_hooks/use-message-outbox';
import {
  markRead,
  mergeCatchUpHistory,
  messagesKey,
  messagesOptions,
  missedMessages,
  orderedMessages,
  roomInfoOptions,
  type MessagePage,
  type RoomMessage,
} from '../_lib/room-api';
import { ChatComposer } from './chat-composer';
import { PendingBubble } from './pending-bubble';
import { MessageTimeline } from './message-timeline';
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
        return {
          ...data,
          pages: data.pages.map((page, index) =>
            index === 0
              ? {
                  ...page,
                  items: [...page.items.filter((item) => item.id !== message.id), message].sort(
                    (a, b) => a.id - b.id,
                  ),
                }
              : page,
          ),
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
      if (page.items.length > CHAT.catchUpMax) {
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
  useStompSubscription<{ event: string; message?: RoomMessage }>(
    `/topic/chat-rooms/${roomId}`,
    (event) => {
      if (event.event === 'MESSAGE' && event.message) receive(event.message);
      else void client.invalidateQueries({ queryKey: messagesKey(viewer.login, roomId) });
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
        <RoomInfoSheet room={room} login={viewer.login} disabled={suspended} />
        {room.team && <PullRequestSheet roomId={roomId} login={viewer.login} />}
      </div>
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
        messages={messages}
        login={viewer.login}
        readPosition={readPosition}
        onRead={(id) => {
          if (id <= lastSeen.current || suspended) return;
          lastSeen.current = id;
          read.mutate(id);
        }}
      />
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
        <div className={styles.notice}>
          <p>
            {room.requestDirection === 'RECEIVED'
              ? '요청을 수락하면 대화가 열려요.'
              : '상대가 수락하면 대화가 열려요'}
          </p>
          <Button asChild variant="outline">
            <Link href="/chats?tab=REQUEST">메시지 요청함</Link>
          </Button>
        </div>
      ) : (
        <>
          {readOnly && <p role="status">지금은 대화를 읽을 수만 있어요.</p>}
          <ChatComposer
            disabled={readOnly}
            onSend={(text) =>
              outbox.enqueue({
                clientMessageId: crypto.randomUUID(),
                text,
                createdAt: new Date().toISOString(),
              })
            }
          />
        </>
      )}
    </div>
  );
}
