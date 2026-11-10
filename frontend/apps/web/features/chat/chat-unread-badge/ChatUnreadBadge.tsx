'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';
import { useStompSubscription } from '@/lib/realtime/use-stomp';

import { chatKeys, unreadSummaryOptions } from '../chat-queries';
import styles from './ChatUnreadBadge.module.css';

/** Shared by the bottom menu; listens even when another tab's page is open. */
export function ChatUnreadBadge() {
  const { login, role } = useViewer();
  const enabled = role !== 'guest' && login !== null;
  const client = useQueryClient();
  // Chrome badge: a slow count must never take over the screen (blueprint §5-5)
  const summary = useQuery({ ...unreadSummaryOptions(login), enabled, meta: { background: true } });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: chatKeys.account(login) });
  };
  useStompSubscription('/user/queue/chat-rooms', refresh, { enabled, onResubscribe: refresh });
  if (!enabled || !summary.data) return null;
  const count = summary.data.total || summary.data.requestCount;
  if (count === 0) return null;
  return (
    <span
      className={styles.badge}
      aria-label={`읽지 않은 메시지 ${summary.data.total}개, 받은 요청 ${summary.data.requestCount}건`}
    >
      {count}
    </span>
  );
}
