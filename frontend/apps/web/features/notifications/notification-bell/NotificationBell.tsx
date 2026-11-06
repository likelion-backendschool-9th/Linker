'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';

import { useViewer } from '@/lib/auth/viewer-context';

import { notificationCountOptions } from '../notification-queries';
import styles from './NotificationBell.module.css';

export function NotificationBell({
  className,
  compact = false,
  initiallyUnread = false,
}: {
  className?: string;
  compact?: boolean;
  initiallyUnread?: boolean;
}) {
  const { login, role } = useViewer();
  const count = useQuery({
    ...notificationCountOptions(login),
    enabled: role !== 'guest' && login !== null,
  });
  const unread = count.data ? count.data.count > 0 : initiallyUnread;
  return (
    <Link href="/notifications" className={className}>
      {compact ? <Bell aria-hidden /> : '알람'}
      {unread && <span className={styles.dot} aria-hidden />}
      <span className="sr-only">
        {compact ? '알림' : ''}
        {unread ? ' (안 읽은 알림 있음)' : ''}
      </span>
    </Link>
  );
}
