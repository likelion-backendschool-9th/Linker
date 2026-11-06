'use client';

import { useQueryClient } from '@tanstack/react-query';

import { useViewer } from '@/lib/auth/viewer-context';
import { useStompSubscription } from '@/lib/realtime/use-stomp';

import { notificationKeys } from '../notification-queries';

/** One user-queue subscription for the app, independent of the open page or header variant. */
export function NotificationRealtime() {
  const { login, role } = useViewer();
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: notificationKeys.account(login) });
  };
  useStompSubscription('/user/queue/notifications', refresh, {
    enabled: role !== 'guest' && login !== null,
    onResubscribe: refresh,
  });
  return null;
}
