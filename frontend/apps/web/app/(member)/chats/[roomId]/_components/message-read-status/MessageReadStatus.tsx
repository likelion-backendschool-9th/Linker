import type { RoomInfo, RoomMessage } from '../../_lib/room-api';
import styles from '../chat-room/ChatRoom.module.css';

type Props = {
  message: RoomMessage;
  kind: RoomInfo['kind'];
  mine: boolean;
  onUnread?: (id: number) => void;
};

export function MessageReadStatus({ message, kind, mine, onUnread }: Props) {
  if (message.deletedAt || message.visibility === 'HIDDEN' || message.visibility === 'UNDER_REVIEW' ||
    message.type === 'SYSTEM' || message.type === 'PR_EVENT' || kind === 'REQUEST') return null;
  // A missing or invalid server value must never look like confirmation that everyone read it.
  if (!Number.isInteger(message.unreadCount) || message.unreadCount < 0) {
    return <p className={styles.meta}>읽음 상태를 확인할 수 없어요.</p>;
  }
  if (kind === 'DIRECT') {
    return mine ? <p className={styles.meta}>{message.unreadCount === 0 ? '읽음' : '안 읽음'}</p> : null;
  }
  return message.unreadCount > 0 ? (
    <button type="button" className={styles.unreadCount} aria-label={`안 읽은 사람 ${message.unreadCount}명`} onClick={() => onUnread?.(message.id)}>
      {message.unreadCount}
    </button>
  ) : null;
}
