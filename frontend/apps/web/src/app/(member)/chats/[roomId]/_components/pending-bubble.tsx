import { Button } from '@/components/ui/button';
import type { PendingMessage } from '../_lib/message-outbox';
import styles from './chat-room.module.css';

// Pending bubbles have no server ID and must never be marked as read.
export function PendingBubble({
  item,
  onRetry,
  onDiscard,
}: {
  item: PendingMessage;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <article className={`${styles.message} ${styles.mine}`} aria-label="보내는 메시지">
      <p className={styles.author}>나</p>
      <div className={`${styles.bubble} ${styles.pending}`}>
        <p className={styles.text}>{item.text}</p>
      </div>
      <p className={styles.meta} role="status">
        {item.status === 'failed'
          ? '보내지 못했어요.'
          : item.status === 'queued'
            ? '전송 대기 중…'
            : '보내는 중…'}
      </p>
      {item.status === 'failed' && (
        <div className={styles.actions}>
          <Button variant="outline" onClick={onRetry}>
            다시 보내기
          </Button>
          <Button variant="soft" onClick={onDiscard}>
            삭제
          </Button>
        </div>
      )}
    </article>
  );
}
