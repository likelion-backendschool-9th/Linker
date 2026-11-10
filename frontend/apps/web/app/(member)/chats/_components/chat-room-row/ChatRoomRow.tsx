import { BellOff, UsersRound } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import type { ChatRoom } from '@/features/chat/chat-queries';

import styles from './ChatRoomRow.module.css';
import { useRowMenuGesture } from './hook';

type Props = {
  room: ChatRoom;
  /** Row menu (방 나가기·읽음 처리); omitted for rows without one (sent requests) */
  onOpenMenu?: () => void;
};

/**
 * Figma 16 row (247:1035, 321:2417): photo, name (+ "채용 제안"), time, last message, unread count.
 * A received request has no row button (latest design, 2026-11-10): it is deleted from the row menu
 * and accepted in the room's request panel (17).
 * Right-click, the keyboard menu key or a long press opens the row menu.
 */
export function ChatRoomRow({ room, onOpenMenu }: Props) {
  const gesture = useRowMenuGesture(onOpenMenu);
  const request = room.kind === 'REQUEST';
  const sent = request && room.requestDirection === 'SENT';
  return (
    <article className={styles.room} {...gesture}>
      <Link
        href={`/chats/${room.id}` as Route}
        className={sent ? `${styles.link} ${styles.withAction}` : styles.link}
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
      {sent && <span className={styles.pending}>대기 중</span>}
    </article>
  );
}
