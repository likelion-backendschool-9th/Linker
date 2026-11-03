import { Button } from '@/components/ui/button';

import Image from 'next/image';
import { MoreHorizontal } from 'lucide-react';

import { RelativeTime } from '@/components/ui/relative-time';

import type { RoomMessage } from '../_lib/room-api';
import styles from './chat-room.module.css';
import { PrEventCard } from './pr-event-card';

type Props = { message: RoomMessage; mine: boolean; onPhoto?: (id: number, index: number) => void; onMenu?: (id: number) => void };

export function ChatMessage({ message, mine, onMenu, onPhoto }: Props) {
  const system = message.type === 'SYSTEM' || message.type === 'PR_EVENT';
  const hidden = message.visibility === 'HIDDEN' || message.visibility === 'UNDER_REVIEW';
  return (
    <article
      className={`${styles.message} ${mine ? styles.mine : ''} ${system ? styles.system : ''}`}
    >
      <p className={styles.author}>
        {system
          ? message.type === 'PR_EVENT'
            ? 'GitHub'
            : '안내'
          : (message.sender?.name ?? '탈퇴한 사용자')}
      </p>
      <div className={styles.bubble}>
        {message.deletedAt ? (
          <p>삭제된 메시지입니다</p>
        ) : hidden ? (
          <p>운영 정책에 따라 숨겨진 메시지예요</p>
        ) : (
          <>
            {message.type === 'PR_EVENT' ? (
              <PrEventCard message={message} />
            ) : (
              message.text && <p className={styles.text}>{message.text}</p>
            )}
            {!!message.imageUrls.length && (
              <div className={styles.images}>
                {message.imageUrls.map((url, index) => (
                  <button
                    type="button"
                    className={`${styles.image} ${styles.imageButton}`}
                    key={`${url}-${index}`}
                    aria-label={`채팅 이미지 ${index + 1} 크게 보기`}
                    onClick={() => onPhoto?.(message.id, index)}
                  >
                    <Image
                      src={url}
                      alt={`채팅 이미지 ${index + 1}`}
                      fill
                      sizes="(max-width: 600px) 50vw, 320px"
                    />
                  </button>
                ))}
              </div>
            )}
            {message.type === 'ISSUE_CARD' && (
              <p className={styles.card}>이슈 · {String(message.payload?.title ?? '이슈 카드')}</p>
            )}
            {message.type === 'SHARE_CARD' && (
              <p className={styles.card}>
                공유 · {String(message.payload?.title ?? '공유한 항목')}
              </p>
            )}
            {message.type === 'AI_SUMMARY' && (
              <p className={styles.card}>AI 요약 · {String(message.payload?.oneLine ?? '')}</p>
            )}
          </>
        )}
      </div>
      <p className={styles.meta}>
        <RelativeTime value={message.createdAt} />
        {message.editedAt && !message.deletedAt && ' · 수정됨'}
      </p>
      {!system && !hidden && !message.deletedAt && onMenu && (
        <Button variant="soft" aria-label={`${message.sender?.name ?? '탈퇴한 사용자'} 메시지 메뉴`} onClick={() => onMenu(message.id)}>
          <MoreHorizontal aria-hidden />
        </Button>
      )}
    </article>
  );
}
