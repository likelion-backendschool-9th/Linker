import Image from 'next/image';

import { Button } from '@/components/ui/button/Button';
import type { PendingMessage } from '../../_lib/message-outbox';
import styles from '../chat-room/ChatRoom.module.css';

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
      <div className={styles.messageRow}>
        <div className={`${styles.bubble} ${styles.pending}`}>
          {item.text && <p className={styles.text}>{item.text}</p>}
          {!!item.images?.length && (
            <div className={styles.images}>
              {item.images.map((image, index) => (
                <div className={styles.image} key={image.fileId}>
                  <Image
                    src={image.url}
                    alt={`전송 대기 사진 ${index + 1}`}
                    width={220}
                    height={220}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.messageMeta}>
          <p className={styles.meta} role="status">
            {item.status === 'failed'
              ? '보내지 못했어요.'
              : item.status === 'queued'
                ? '전송 대기 중…'
                : '보내는 중…'}
          </p>
        </div>
      </div>
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
