'use client';

import Image from 'next/image';

import { formatMessageTime, toKstIso } from '@/lib/format/time';
import { messagePayload } from '@/features/share/chat-cards';
import { messageUrls } from '@/features/share/message-links';

import { useMessageMenu } from '../../_hooks/use-message-menu';
import type { RoomInfo, RoomMessage } from '../../_lib/room-api';
import type { ChatIssueCard } from '../../_lib/chat-reference-types';
import styles from '../chat-room/ChatRoom.module.css';
import { MessageReadStatus } from '../message-read-status';
import { IssueMessageCards } from '../issue-message-cards';
import { PrEventCard } from '../pr-event-card';
import { SharedContentCard } from '../shared-content-card';
import { ExternalLinkPreview } from '../external-link-preview';
import { AiSummaryCard } from '../ai-summary-card';

type Props = {
  message: RoomMessage;
  previousMessage?: RoomMessage;
  mine: boolean;
  kind: RoomInfo['kind'];
  onUnread?: (id: number) => void;
  onPhoto?: (id: number, index: number) => void;
  onMenu?: (id: number) => void;
  /** Search keyword to mark inside the text (only passed to the selected search result) */
  highlight?: string;
};

/** Wraps case-insensitive keyword matches in <mark>, like the server's lower(body) LIKE match. */
function highlightText(text: string, keyword?: string) {
  if (!keyword) return text;
  const pattern = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(pattern).map((part, index) =>
    index % 2 ? (
      <mark key={index} className={styles.searchMark}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function SenderAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initial = name.trim().slice(0, 1) || '?';
  return (
    <div className={styles.avatar} aria-hidden>
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill sizes="46px" />
      ) : (
        <span className={styles.avatarFallback}>{initial}</span>
      )}
    </div>
  );
}

export function ChatMessage({
  message,
  previousMessage,
  mine,
  kind,
  onUnread,
  onMenu,
  onPhoto,
  highlight,
}: Props) {
  const system = message.type === 'SYSTEM' || message.type === 'PR_EVENT';
  const hidden = message.visibility === 'HIDDEN';
  // A visible shared summary takes the bubble slot with its own card and menu handling
  const summaryCard = message.type === 'AI_SUMMARY' && !hidden && !message.deletedAt;
  const payload = messagePayload(message.payload);
  const issueCards = Array.isArray(payload?.issueCards)
    ? (payload.issueCards as ChatIssueCard[])
    : [];
  const canMenu = !system && !hidden && !message.deletedAt && !!onMenu;
  // The summary card wires the menu itself; the plain bubble hook stays off for it
  const menu = useMessageMenu(canMenu && !summaryCard, () => onMenu?.(message.id));
  const senderName = message.sender?.name ?? '탈퇴한 사용자';
  // Figma 17: "오명석 님"; the withdrawn placeholder keeps no honorific
  const authorLabel = message.sender ? `${senderName} 님` : senderName;

  const bubble = summaryCard ? (
    <AiSummaryCard message={message} canMenu={canMenu} onMenu={onMenu} />
  ) : (
    <div
      className={`${styles.bubble} ${canMenu ? styles.menuBubble : ''}`}
      role="group"
      tabIndex={canMenu ? 0 : undefined}
      aria-label={canMenu ? `${senderName} 메시지` : undefined}
      aria-keyshortcuts={canMenu ? 'Shift+F10 Enter Space' : undefined}
      title={
        canMenu ? '우클릭, 길게 누르기 또는 Enter 키로 메시지 메뉴를 열 수 있어요.' : undefined
      }
      {...menu}
    >
      {message.deletedAt ? (
        <p>삭제된 메시지입니다</p>
      ) : hidden ? (
        <p>운영 정책에 따라 숨겨진 메시지예요</p>
      ) : (
        <>
          {message.text && <p className={styles.text}>{highlightText(message.text, highlight)}</p>}
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
                  <Image src={url} alt={`채팅 이미지 ${index + 1}`} width={220} height={220} />
                </button>
              ))}
            </div>
          )}
          {issueCards.length > 0 && <IssueMessageCards cards={issueCards} />}
          {message.type === 'SHARE_CARD' && <SharedContentCard value={payload} />}
          {message.type !== 'SHARE_CARD' && !!payload?.linkerCard && (
            <SharedContentCard value={payload.linkerCard} />
          )}
          {!system &&
            kind !== 'REQUEST' &&
            message.text &&
            messageUrls(message.text).length > 0 && (
              <ExternalLinkPreview roomId={message.roomId} text={message.text} />
            )}
        </>
      )}
    </div>
  );

  const meta = (
    <div className={styles.messageMeta}>
      <MessageReadStatus message={message} kind={kind} mine={mine} onUnread={onUnread} />
      <p className={styles.meta}>
        <time dateTime={toKstIso(message.createdAt)} title={toKstIso(message.createdAt)}>
          {formatMessageTime(message.createdAt)}
        </time>
        {message.editedAt && !message.deletedAt && ' · 수정됨'}
      </p>
    </div>
  );

  // B's PR view owns its organization identity and card; regular D message rendering stays below.
  if (message.type === 'PR_EVENT' && !hidden && !message.deletedAt)
    return <PrEventCard message={message} previousMessage={previousMessage} />;

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
          <div className={styles.messageRow}>
            {bubble}
            {meta}
          </div>
        </>
      )}

      {canMenu && (
        <button
          type="button"
          className="sr-only"
          tabIndex={-1}
          aria-haspopup="dialog"
          aria-label={`${senderName} 메시지 메뉴`}
          onClick={() => onMenu?.(message.id)}
        >
          메시지 메뉴 열기
        </button>
      )}
    </article>
  );
}
