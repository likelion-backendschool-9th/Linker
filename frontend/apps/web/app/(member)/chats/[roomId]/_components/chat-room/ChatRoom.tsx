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
import { RequestRoomBar } from '../request-room-bar';
import { RoomInfoSheet } from '../room-info-sheet';
import { PullRequestSheet } from '../pull-request-sheet';
import { AiSummaryFab } from '../ai-summary-fab';
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
    markMessageRead,
    retryReadMark,
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
      {/* Figma has no connection line; screen readers still hear it */}
      <p className="sr-only" role="status">
        {CONNECTION[connection]}
      </p>
      <RoomInfoSheet room={room} login={viewer.login} disabled={suspended} />
      {room.team && (
        <PullRequestSheet
          roomId={roomId}
          login={viewer.login}
          disabled={readOnly}
          onShare={(url) =>
            outbox.enqueue({
              clientMessageId: crypto.randomUUID(),
              text: url,
              images: [],
              createdAt: new Date().toISOString(),
            })
          }
        />
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
      {history.isFetchingNextPage && (
        <p role="status" className="sr-only">
          이전 대화를 불러오는 중이에요.
        </p>
      )}
      <div
        className={
          room.team ? `${styles.timelineArea} ${styles.withSummaryFab}` : styles.timelineArea
        }
      >
        <MessageTimeline
          kind={room.kind}
          onUnread={(id) => unreadMembers.open(String(id))}
          messages={messages}
          login={viewer.login}
          readPosition={readPosition}
          onPhoto={(id, index) => photoViewer.open(`${id}:${index}`)}
          onMenu={(id) => messageMenu.open(String(id))}
          onRead={markMessageRead}
          onReachTop={() => {
            if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
          }}
        />
        {room.team && <AiSummaryFab roomId={roomId} />}
      </div>
      <UnreadMembersSheet room={room} messages={messages} login={viewer.login} />
      <ChatPhotoViewer messages={messages} />
      <MessageActions room={room} messages={messages} login={viewer.login} disabled={readOnly} />
      {read.isError && (
        <div role="alert">
          <p>읽음 상태를 저장하지 못했어요.</p>
          <Button variant="soft" onClick={retryReadMark}>
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
        <RequestRoomBar room={room} login={viewer.login} disabled={suspended} />
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
