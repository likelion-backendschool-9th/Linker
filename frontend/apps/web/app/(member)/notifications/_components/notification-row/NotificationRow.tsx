import type { MouseEvent } from 'react';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { RelativeTime } from '@/components/ui/relative-time/RelativeTime';
import {
  notificationTarget,
  type NotificationItem,
} from '@/features/notifications/notification-queries';

import styles from '../notification-list/NotificationList.module.css';

type Props = {
  item: NotificationItem;
  pending: boolean;
  onOpen: (item: NotificationItem, target: string | null, appeal: boolean) => void;
  onReadInBackground: (id: number) => void;
};

export function NotificationRow({ item, pending, onOpen, onReadInBackground }: Props) {
  const target = notificationTarget(item.targetUrl);
  const content = (
    <>
      <span className={styles.heading}>
        <span className={styles.title}>{item.title}</span>
        {!item.read && <span className={styles.unread}>읽지 않음</span>}
      </span>
      {item.body && <span className={styles.description}>{item.body}</span>}
      <span className={styles.time}>
        <RelativeTime value={item.createdAt} />
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
    <article className={styles.item} aria-busy={pending}>
      {item.appeal ? (
        <>
          <div className={styles.body}>{content}</div>
          <Button variant="outline" disabled={pending} onClick={() => onOpen(item, null, true)}>
            {item.appeal.submitted ? '이의 제기 완료' : '이의 제기하기'}
          </Button>
        </>
      ) : target ? (
        <Link href={target as Route} className={styles.body} onClick={open} aria-disabled={pending}>
          {content}
        </Link>
      ) : (
        <div className={styles.body}>
          {content}
          <p className={styles.description}>연결할 수 없는 알림이에요.</p>
          {!item.read && (
            <Button variant="soft" disabled={pending} onClick={() => onOpen(item, null, false)}>
              읽음 표시
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
