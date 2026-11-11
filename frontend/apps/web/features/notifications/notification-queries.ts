import type {
  NotificationItemResponse,
  NotificationPageResponse,
} from '@linker/api/openAPIDefinition.schemas';
import {
  createAppeal,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@linker/api/p18-notifications/p18-notifications';
import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';

/** `appeal` is set by the server for the caller's own sanction; never infer it from the notification id. */
export type NotificationItem = NotificationItemResponse;
export type NotificationPage = NotificationPageResponse;
/** 18 list tab: every visible notification, or only unread ones (server `unread=true`). */
export type NotificationFilter = 'all' | 'unread';
// Foreground REST recovery also catches quiet-hour rows becoming visible without a new socket event.
const NOTIFICATION_REFRESH_MS = 30_000;
export const notificationKeys = {
  account: (login: string | null) => ['notifications', login] as const,
  /** Prefix of both tab lists; use with `setQueriesData` / `invalidateQueries`. */
  lists: (login: string | null) => ['notifications', login, 'list'] as const,
  list: (login: string | null, filter: NotificationFilter = 'all') =>
    ['notifications', login, 'list', filter] as const,
  count: (login: string | null) => ['notifications', login, 'count'] as const,
};
export function notificationListOptions(login: string | null, filter: NotificationFilter = 'all') {
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(login, filter),
    refetchOnMount: 'always',
    refetchInterval: NOTIFICATION_REFRESH_MS,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      listNotifications(
        {
          ...(pageParam === null ? {} : { cursor: pageParam }),
          ...(filter === 'unread' ? { unread: true } : {}),
        },
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function notificationCountOptions(login: string | null) {
  return queryOptions({
    queryKey: notificationKeys.count(login),
    refetchOnMount: 'always',
    refetchInterval: NOTIFICATION_REFRESH_MS,
    queryFn: ({ signal }) => getUnreadNotificationCount({ signal }),
  });
}
export function readNotification(id: number) {
  return markNotificationRead(id);
}
export function readAllNotifications() {
  return markAllNotificationsRead();
}
export function submitAppeal(sanctionId: number, body: string) {
  return createAppeal({ sanctionId, body });
}
export function updateNotifications(
  data: InfiniteData<NotificationPage> | undefined,
  update: (item: NotificationItem) => NotificationItem,
): InfiniteData<NotificationPage> | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(update) })) };
}

/** Notification destinations must remain inside Linker; reject external and ambiguous URLs. */
export function notificationTarget(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const url = new URL(value, 'https://linker.invalid');
    return url.origin === 'https://linker.invalid'
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}
