import { BellOff, UsersRound } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import type { ChatRoom } from '@/features/chat/chat-queries';

import styles from '../chat-list/ChatList.module.css';

type Props = { room: ChatRoom; disabled: boolean; onAccept: () => void; onDelete: () => void };

export function ChatRoomRow({ room, disabled, onAccept, onDelete }: Props) {
  const received = room.kind === 'REQUEST' && room.requestDirection === 'RECEIVED';
  return (
    <article className={styles.room}>
      <Link href={`/chats/${room.id}` as Route} className={styles.roomLink}>
        <span className={styles.avatar}>
          {room.counterpart?.avatarUrl ? (
            <Image src={room.counterpart.avatarUrl} alt="" fill sizes="48px" />
          ) : (
            <UsersRound aria-hidden />
          )}
        </span>
        <div className={styles.body}>
          <div className={styles.heading}>
            {room.title ? <h2 className={styles.title}>{room.title}</h2> : null}
            {room.muted && (
              <span role="img" aria-label="알림 꺼짐">
                <BellOff aria-hidden className={styles.mutedIcon} />
              </span>
            )}
          </div>
          {room.requestKind === 'RECRUITING' && (
            <p className={styles.offer}>채용 제안 · {room.companyName}</p>
          )}
          {room.lastMessage?.text ? (
            <p className={styles.preview}>{room.lastMessage.text}</p>
          ) : room.lastMessage ? null : (
            <p className={styles.preview}>아직 메시지가 없어요.</p>
          )}
          {room.kind === 'REQUEST' && room.requestDirection === 'SENT' && (
            <p className={styles.meta}>대기 중 · 상대가 수락하면 대화가 열려요</p>
          )}
        </div>
        <div className={styles.trailing}>
          {room.lastMessage && (
            <span className={styles.meta}>
              <RelativeTime value={room.lastMessage.createdAt} />
            </span>
          )}
          {room.unreadCount > 0 && (
            <span className={styles.count} aria-label={`읽지 않은 메시지 ${room.unreadCount}개`}>
              {room.unreadCount}
            </span>
          )}
        </div>
      </Link>
      {received && (
        <div className={styles.actions}>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={onDelete}
            aria-label={room.title ? `${room.title} 요청 삭제` : '요청 삭제'}
          >
            삭제
          </Button>
          <Button disabled={disabled} onClick={onAccept} aria-label={room.title ? `${room.title} 요청 수락` : '요청 수락'}>
            수락
          </Button>
        </div>
      )}
    </article>
  );
}
