import { BellOff, Minus, UsersRound } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import type { ChatRoom } from '@/features/chat/chat-queries';

import styles from './ChatRoomRow.module.css';

type Props = { room: ChatRoom; disabled: boolean; onDelete: () => void };

/**
 * Figma 16 row (247:1035, 321:2417): photo, name (+ "채용 제안"), time, last message, unread count.
 * A received request gets the red "삭제" button; accepting happens in the room's request panel (17).
 */
export function ChatRoomRow({ room, disabled, onDelete }: Props) {
  const request = room.kind === 'REQUEST';
  const received = request && room.requestDirection === 'RECEIVED';
  const sent = request && room.requestDirection === 'SENT';
  return (
    <article className={styles.room}>
      <Link
        href={`/chats/${room.id}` as Route}
        className={received || sent ? `${styles.link} ${styles.withAction}` : styles.link}
      >
        <span className={styles.avatar} aria-hidden>
          {room.counterpart?.avatarUrl ? (
            <Image src={room.counterpart.avatarUrl} alt="" fill sizes="50px" />
          ) : (
            <UsersRound />
          )}
        </span>
        <div className={styles.body}>
          <div className={styles.line}>
            <div className={styles.name}>
              {room.title ? <h2 className={styles.title}>{room.title}</h2> : null}
              {room.requestKind === 'RECRUITING' && (
                <span className={styles.offer}>
                  채용 제안{room.companyName ? ` · ${room.companyName}` : ''}
                </span>
              )}
              {room.muted && (
                <span role="img" aria-label="알림 꺼짐" className={styles.muted}>
                  <BellOff aria-hidden />
                </span>
              )}
            </div>
            {!request && room.lastMessage && (
              <span className={styles.time}>
                <RelativeTime value={room.lastMessage.createdAt} />
              </span>
            )}
          </div>
          <div className={styles.line}>
            <p className={styles.preview}>
              {room.lastMessage ? (room.lastMessage.text ?? '') : '아직 메시지가 없어요.'}
            </p>
            {room.unreadCount > 0 && (
              <span className={styles.count} aria-label={`읽지 않은 메시지 ${room.unreadCount}개`}>
                {room.unreadCount}
              </span>
            )}
          </div>
        </div>
      </Link>
      {received && (
        <button
          type="button"
          className={styles.delete}
          disabled={disabled}
          onClick={onDelete}
          aria-label={room.title ? `${room.title} 요청 삭제` : '요청 삭제'}
        >
          <span className={styles.deleteCircle} aria-hidden>
            <Minus />
          </span>
        </button>
      )}
      {sent && <span className={styles.pending}>대기 중</span>}
    </article>
  );
}
