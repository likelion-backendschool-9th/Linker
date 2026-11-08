import 'server-only';

import { getUnreadNotificationCount } from '@linker/api/p18-notifications/p18-notifications';
import { cache } from 'react';

/** `GET /api/v1/user/notifications/unread-count` (NotificationController); drives the header's 알람 dot. */
export const hasUnreadNotifications = cache(async (): Promise<boolean> => {
  const { count } = await getUnreadNotificationCount();
  return count > 0;
});
