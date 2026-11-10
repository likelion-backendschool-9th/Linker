'use client';

import { useQuery } from '@tanstack/react-query';
import { BellLinearIcon } from '@solar-icons/static/linear/bell';
import Link from 'next/link';

import { Icon } from '@/components/ui/icon';
import { useViewer } from '@/lib/auth/viewer-context';

import { notificationCountOptions } from '../notification-queries';
import styles from './NotificationBell.module.css';

export function NotificationBell({
  className,
  initiallyUnread = false,
}: {
  className?: string;
  initiallyUnread?: boolean;
}) {
  const { login, role } = useViewer();
  // Chrome badge: a slow count must never take over the screen (blueprint §5-5)
  const count = useQuery({
    ...notificationCountOptions(login),
    meta: { background: true },
    enabled: role !== 'guest' && login !== null,
  });
  const unread = count.data ? count.data.count > 0 : initiallyUnread;
  return (
    <Link href="/notifications" className={className}>
      <Icon svg={BellLinearIcon} />
      {unread && <span className={styles.dot} aria-hidden />}
      <span className="sr-only">알림{unread ? ' (안 읽은 알림 있음)' : ''}</span>
    </Link>
  );
}
