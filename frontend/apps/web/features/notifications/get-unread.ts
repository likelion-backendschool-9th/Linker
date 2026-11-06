import 'server-only';

import { cache } from 'react';

import { apiFetch } from '@/lib/api/api-fetch';

/** `GET /api/v1/user/notifications/unread-count` (NotificationController); drives the header's 알람 dot. */
export const hasUnreadNotifications = cache(async (): Promise<boolean> => {
  const { count } = await apiFetch<{ count: number }>('/api/v1/user/notifications/unread-count');
  return count > 0;
});
