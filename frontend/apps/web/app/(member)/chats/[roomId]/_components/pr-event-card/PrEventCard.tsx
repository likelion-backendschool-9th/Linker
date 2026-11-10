'use client';

import Image from 'next/image';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import type { RoomMessage } from '../../_lib/room-api';
import { usePrEventCard } from './hook';
import styles from './PrEventCard.module.css';

/** Figma 750:3036: organization identity and four immutable PR event cards. */
export function PrEventCard({
  message,
  previousMessage,
}: {
  message: RoomMessage;
  previousMessage?: RoomMessage;
}) {
  const {
    event,
    label,
    number,
    title,
    organization,
    repository,
    repo,
    url,
    showOrganization,
    avatarUrl,
    onAvatarError,
    openExternal,
  } = usePrEventCard(message, previousMessage);
  const content = (
    <>
      <Image
        src="/images/chat-pull-requests/github.svg"
        className={styles.mark}
        width={32}
        height={32}
        alt=""
        aria-hidden
      />
      <span className={styles.body}>
        <span className={styles.event} data-event={event}>
          {label}
        </span>
        <span className={styles.title}>
          {number !== null && `#${number} `}
          {title}
        </span>
        <span className={styles.meta}>
          {repository && (
            <>
              <span title={repo}>{repository}</span>
              <span className={styles.dot} aria-hidden />
            </>
          )}
          <RelativeTime value={message.createdAt} />
        </span>
      </span>
    </>
  );
  return (
    <article className={styles.message} aria-label={label}>
      {showOrganization && organization && (
        <>
          <div className={styles.avatar} aria-hidden>
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="46px" onError={onAvatarError} />
            ) : (
              <span>{organization.slice(0, 1)}</span>
            )}
          </div>
          <p className={styles.organization}>{organization}</p>
        </>
      )}
      {url ? (
        <button type="button" className={styles.card} onClick={() => openExternal(url)}>
          {content}
          <span className="sr-only">GitHub에서 열기</span>
        </button>
      ) : (
        <div className={styles.card}>{content}</div>
      )}
    </article>
  );
}
