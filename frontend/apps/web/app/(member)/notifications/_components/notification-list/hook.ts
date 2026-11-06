'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { toKstIso } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  notificationCountOptions,
  notificationKeys,
  notificationListOptions,
  readAllNotifications,
  readNotification,
  updateNotifications,
  type NotificationItem,
  type NotificationPage,
} from './api';

type ReadAction =
  | { kind: 'all' }
  | { kind: 'one'; id: number; target: string | null; appeal: boolean };

export function useNotificationList() {
  const { login } = useViewer();
  const router = useRouter();
  const client = useQueryClient();
  const overlay = useOverlay('appeal');
  const list = useInfiniteQuery(notificationListOptions(login));
  const count = useQuery(notificationCountOptions(login));
  const items = useMemo(() => {
    const unique = new Map<number, NotificationItem>();
    for (const page of list.data?.pages ?? [])
      for (const item of page.items) if (!unique.has(item.id)) unique.set(item.id, item);
    return [...unique.values()];
  }, [list.data]);
  const groups = useMemo(() => {
    const grouped = new Map<string, NotificationItem[]>();
    for (const item of items) {
      const date = toKstIso(item.createdAt).slice(0, 10);
      grouped.set(date, [...(grouped.get(date) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [items]);
  const read = useMutation({
    mutationFn: (action: ReadAction) =>
      action.kind === 'all' ? readAllNotifications() : readNotification(action.id),
    onSuccess: async (_, action) => {
      client.setQueryData<InfiniteData<NotificationPage>>(notificationKeys.list(login), (data) =>
        updateNotifications(data, (item) =>
          action.kind === 'all' || item.id === action.id ? { ...item, read: true } : item,
        ),
      );
      if (action.kind === 'all') {
        client.setQueryData(notificationKeys.count(login), { count: 0 });
        toast('모든 알림을 읽음으로 표시했어요.');
      }
      await client.invalidateQueries({ queryKey: notificationKeys.account(login) });
    },
  });
  async function perform(action: ReadAction) {
    if (read.isPending) return;
    try {
      await read.mutateAsync(action);
      if (action.kind === 'one') {
        if (action.appeal) overlay.open(String(action.id));
        else if (action.target) router.push(action.target as Route);
      }
    } catch {
      /* Keep the list open with a retry instead of navigating after a failed read. */
    }
  }
  function open(item: NotificationItem, target: string | null, appeal: boolean) {
    if (read.isPending) return;
    if (item.read) {
      if (appeal) overlay.open(String(item.id));
      return;
    }
    void perform({ kind: 'one', id: item.id, target, appeal });
  }
  const selected = items.find((item) => String(item.id) === overlay.id) ?? null;

  return {
    overlay,
    list,
    count,
    items,
    groups,
    read,
    perform,
    open,
    selected,
  };
}
