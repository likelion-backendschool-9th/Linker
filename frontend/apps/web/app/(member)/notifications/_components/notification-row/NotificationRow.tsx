import type { MouseEvent } from 'react';
import type { Route } from 'next';
import Link from 'next/link';

import {
  notificationTarget,
  type NotificationItem,
} from '@/features/notifications/notification-queries';

import styles from './NotificationRow.module.css';

type Props = {
  item: NotificationItem;
  pending: boolean;
  onOpen: (item: NotificationItem, target: string | null, appeal: boolean) => void;
  onReadInBackground: (id: number) => void;
};

/**
 * Figma 248:1387 / 248:1391: dot + title, with the server body (message preview, post or issue
 * title) on a second line. Unread uses the dark dot and text, read the muted ones.
 */
export function NotificationRow({ item, pending, onOpen, onReadInBackground }: Props) {
  const target = notificationTarget(item.targetUrl);
  const state = item.read ? 'read' : 'unread';
  const content = (
    <>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>
        {!item.read && <span className="sr-only">읽지 않음, </span>}
        <span className={styles.title}>{item.title}</span>
        {item.body && (
          <>
            {' '}
            <span className={styles.body}>{item.body}</span>
          </>
        )}
        {item.appeal && (
          <span className={styles.appeal}>
            {item.appeal.submitted ? '이의 제기 완료' : '이의 제기하기'}
          </span>
        )}
      </span>
    </>
  );
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (item.read) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      onReadInBackground(item.id);
      return;
    }
    event.preventDefault();
    onOpen(item, target, false);
  }
  return (
    <article aria-busy={pending}>
      {item.appeal ? (
        <button
          type="button"
          className={styles.row}
          data-state={state}
          disabled={pending}
          onClick={() => onOpen(item, null, true)}
        >
          {content}
        </button>
      ) : target ? (
        <Link
          href={target as Route}
          className={styles.row}
          data-state={state}
          onClick={open}
          aria-disabled={pending}
        >
          {content}
        </Link>
      ) : item.read ? (
        <div className={styles.row} data-state={state}>
          {content}
        </div>
      ) : (
        <button
          type="button"
          className={styles.row}
          data-state={state}
          disabled={pending}
          onClick={() => onOpen(item, null, false)}
        >
          {content}
        </button>
      )}
    </article>
  );
}
