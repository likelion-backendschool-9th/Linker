'use client';

import { Button } from '@/components/ui/button/Button';
import { formatDate, toKstIso } from '@/lib/format/time';

import type { RoomInfo, RoomMessage } from '../../_lib/room-api';
import { ChatMessage } from '../chat-message';
import styles from '../chat-room/ChatRoom.module.css';

import { useMessageTimeline } from './hook';

type Props = {
  messages: RoomMessage[];
  kind: RoomInfo['kind'];
  onUnread?: (id: number) => void;
  login: string | null;
  onRead: (id: number) => void;
  onPhoto?: (id: number, index: number) => void;
  onMenu?: (id: number) => void;
  readPosition?: { id: number } | null;
};

export function MessageTimeline({
  messages,
  kind,
  onUnread,
  login,
  onRead,
  readPosition,
  onMenu,
  onPhoto,
}: Props) {
  const { root, atBottom, setAtBottom, virtualizer, rows, jumpToLatest } = useMessageTimeline({
    messages,
    onRead,
    readPosition,
  });

  return (
    <>
      <div
        ref={root}
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-label="대화 내용"
        onScroll={(event) => {
          const node = event.currentTarget;
          setAtBottom(
            node.scrollHeight - node.scrollTop - node.clientHeight < node.clientHeight / 4,
          );
        }}
      >
        {!messages.length && (
          <p className={styles.notice}>아직 메시지가 없어요. 첫 대화를 시작해 보세요.</p>
        )}
        <div className={styles.virtualSpace} style={{ height: virtualizer.getTotalSize() }}>
          {rows.map((row) => {
            const message = messages[row.index]!;
            const previous = messages[row.index - 1];
            const date = toKstIso(message.createdAt).slice(0, 10);
            const showDate = !previous || toKstIso(previous.createdAt).slice(0, 10) !== date;
            return (
              <div
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                data-message-id={message.id}
                className={styles.virtualRow}
                style={{ transform: `translateY(${row.start}px)` }}
              >
                {showDate && (
                  <p className={styles.date}>
                    <time dateTime={date}>{formatDate(message.createdAt)}</time>
                  </p>
                )}
                <ChatMessage
                  kind={kind}
                  onUnread={onUnread}
                  message={message}
                  mine={message.sender?.login === login}
                  onMenu={onMenu}
                  onPhoto={onPhoto}
                />
              </div>
            );
          })}
        </div>
      </div>
      {!atBottom && (
        <Button variant="soft" onClick={jumpToLatest}>
          최신 메시지로 이동
        </Button>
      )}
    </>
  );
}
