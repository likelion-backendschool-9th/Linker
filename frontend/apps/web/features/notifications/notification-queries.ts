import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional WBS 18 contract; switch to Orval when OpenAPI is published. */
export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  targetUrl: string;
  read: boolean;
  createdAt: string;
  /** The server supplies eligibility and the sanction identifier; never infer it from notification ID. */
  appeal?: { sanctionId: number; submitted: boolean };
};
export type NotificationPage = { items: NotificationItem[]; nextCursor: string | null };
export const notificationKeys = {
  account: (login: string | null) => ['notifications', login] as const,
  list: (login: string | null) => ['notifications', login, 'list'] as const,
  count: (login: string | null) => ['notifications', login, 'count'] as const,
};
export function notificationListOptions(login: string | null) {
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(login),
    refetchOnMount: 'always',
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiFetch<NotificationPage>(
        `/api/v1/user/notifications${pageParam === null ? '' : `?cursor=${encodeURIComponent(pageParam)}`}`,
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}
export function notificationCountOptions(login: string | null) {
  return queryOptions({
    queryKey: notificationKeys.count(login),
    refetchOnMount: 'always',
    queryFn: ({ signal }) =>
      apiFetch<{ count: number }>('/api/v1/user/notifications/unread-count', { signal }),
  });
}
export function readNotification(id: number) {
  return apiFetch<void>(`/api/v1/user/notifications/${id}/read`, { method: 'PATCH' });
}
export function readAllNotifications() {
  return apiFetch<void>('/api/v1/user/notifications/read-all', { method: 'POST' });
}
export function submitAppeal(sanctionId: number, body: string) {
  return apiFetch<{ appealId: number }>('/api/v1/user/appeals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sanctionId, body }),
  });
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
