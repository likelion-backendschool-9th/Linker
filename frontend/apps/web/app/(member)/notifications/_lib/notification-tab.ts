import { createLoader, parseAsStringLiteral } from 'nuqs/server';

import type { NotificationFilter } from '@/features/notifications/notification-queries';

/** 18 tabs (Figma 248:1373): "전체" / "읽지 않음". Kept in the URL as `?tab=unread`; the default leaves it clean. */
export const NOTIFICATION_TABS = ['all', 'unread'] as const satisfies readonly NotificationFilter[];

export const notificationTabParser = parseAsStringLiteral(NOTIFICATION_TABS).withDefault('all');

/** Figma copy, verbatim */
export const NOTIFICATION_TAB_LABELS: Record<NotificationFilter, string> = {
  all: '전체',
  unread: '읽지 않음',
};

export const loadNotificationTab = createLoader({ tab: notificationTabParser });
