'use client';

import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { CHAT } from '@/lib/policy';

import { ChatPhotoViewer } from '../chat-photo-viewer';
import { ChatComposer } from '../chat-composer';
import { PendingBubble } from '../pending-bubble';
import { MessageActions } from '../message-actions';
import { UnreadMembersSheet } from '../unread-members-sheet';
import { MessageTimeline } from '../message-timeline';
import { ChatRoomMenu } from '../chat-room-menu';
import { RequestRoomBar } from '../request-room-bar';
import { RoomInfoSheet } from '../room-info-sheet';
import { PullRequestSheet } from '../pull-request-sheet';
import styles from './ChatRoom.module.css';
import { CONNECTION, useChatRoom } from './hook';

export function ChatRoom({ roomId }: { roomId: number }) {
  const {
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
    lastSeen,
    suspended,
    readOnly,
    room,
  } = useChatRoom(roomId);

  if (info.isPending || history.isPending)
    return (
      <div aria-busy="true">
        <p role="status">대화를 불러오고 있어요.</p>
        <Skeleton count={3} />
      </div>
    );
  if (info.isError || !room)
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
