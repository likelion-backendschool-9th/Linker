'use client';

import Image from 'next/image';

import { formatMessageTime, toKstIso } from '@/lib/format/time';

import { useMessageMenu } from '../_hooks/use-message-menu';
import type { RoomInfo, RoomMessage } from '../_lib/room-api';
import styles from './chat-room.module.css';
import { MessageReadStatus } from './message-read-status';
import { IssueMessageCards } from './issue-message-cards';
import { PrEventCard } from './pr-event-card';

type Props = { message: RoomMessage; mine: boolean; kind: RoomInfo['kind']; onUnread?: (id: number) => void; onPhoto?: (id: number, index: number) => void; onMenu?: (id: number) => void };

function SenderAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initial = name.trim().slice(0, 1) || '?';
  return (
    <div className={styles.avatar} aria-hidden>
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill sizes="40px" />
      ) : (
        <span className={styles.avatarFallback}>{initial}</span>
      )}
    </div>
  );
}

export function ChatMessage({ message, mine, kind, onUnread, onMenu, onPhoto }: Props) {
  const system = message.type === 'SYSTEM' || message.type === 'PR_EVENT';
  const hidden = message.visibility === 'HIDDEN' || message.visibility === 'UNDER_REVIEW';
  const canMenu = !system && !hidden && !message.deletedAt && !!onMenu;
  const menu = useMessageMenu(canMenu, () => onMenu?.(message.id));
  const senderName = message.sender?.name ?? '탈퇴한 사용자';
  const authorLabel = system ? (message.type === 'PR_EVENT' ? 'GitHub' : '안내') : senderName;

  const bubble = (
    <div
      className={`${styles.bubble} ${canMenu ? styles.menuBubble : ''}`}
      role="group"
      tabIndex={canMenu ? 0 : undefined}
      aria-label={canMenu ? `${senderName} 메시지` : undefined}
      aria-keyshortcuts={canMenu ? 'Shift+F10 Enter Space' : undefined}
      title={canMenu ? '우클릭, 길게 누르기 또는 Enter 키로 메시지 메뉴를 열 수 있어요.' : undefined}
      {...menu}
    >
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
          {!!message.payload?.issueCards?.length && <IssueMessageCards cards={message.payload.issueCards} />}
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
  );

  const meta = (
    <div className={styles.messageMeta}>
      <MessageReadStatus message={message} kind={kind} mine={mine} onUnread={onUnread} />
      <p className={styles.meta}>
        <time dateTime={toKstIso(message.createdAt)} title={toKstIso(message.createdAt)}>{formatMessageTime(message.createdAt)}</time>
        {message.editedAt && !message.deletedAt && ' · 수정됨'}
      </p>
    </div>
  );

  return (
    <article
      className={`${styles.message} ${mine ? styles.mine : ''} ${system ? styles.system : ''}`}
    >
      {!system && !mine ? (
        <div className={styles.incoming}>
          <SenderAvatar name={senderName} avatarUrl={message.sender?.avatarUrl || undefined} />
          <div className={styles.incomingBody}>
            <p className={styles.author}>{authorLabel}</p>
            <div className={styles.messageRow}>
              {bubble}
              {meta}
            </div>
          </div>
        </div>
      ) : (
        <>
          {system && <p className={styles.author}>{authorLabel}</p>}
          <div className={styles.messageRow}>
            {bubble}
            {meta}
          </div>
        </>
      )}

      {canMenu && <button
        type="button"
        className="sr-only"
        tabIndex={-1}
        aria-haspopup="dialog"
        aria-label={`${senderName} 메시지 메뉴`}
        onClick={() => onMenu?.(message.id)}
      >메시지 메뉴 열기</button>}
    </article>
  );
}
