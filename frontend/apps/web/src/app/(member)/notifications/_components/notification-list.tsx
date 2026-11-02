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

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  notificationCountOptions,
  notificationKeys,
  notificationListOptions,
  readAllNotifications,
  readNotification,
  updateNotifications,
  type NotificationItem,
  type NotificationPage,
} from '@/features/notifications/notification-queries';
import { useViewer } from '@/lib/auth/viewer-context';
import { formatDate, toKstIso } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { AppealSheet } from './appeal-sheet';
import { NotificationRow } from './notification-row';
import styles from './notification-list.module.css';

type ReadAction =
  { kind: 'all' } | { kind: 'one'; id: number; target: string | null; appeal: boolean };

export function NotificationList() {
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

  return (
    <>
      <div className={styles.toolbar}>
        <p role="status" className={styles.description}>
          {count.data ? `읽지 않은 알림 ${count.data.count}개` : '알림 확인 중…'}
        </p>
        <Button
          variant="outline"
          disabled={read.isPending || !count.data || count.data.count === 0}
          onClick={() => {
            void perform({ kind: 'all' });
          }}
        >
          모두 읽음
        </Button>
      </div>
      {count.isError && (
        <ErrorState
          title="읽지 않은 알림 수를 불러오지 못했어요"
          onRetry={() => {
            void count.refetch();
          }}
        />
      )}
      {read.isError && (
        <ErrorState
          title="읽음 상태를 저장하지 못했어요"
          onRetry={() => {
            if (read.variables) void perform(read.variables);
          }}
        />
      )}
      <section aria-label="알림 목록" aria-busy={list.isPending}>
        {list.isPending ? (
          <LoadingIndicator label="알림을 불러오고 있어요." variant="block">
            <Skeleton count={3} />
          </LoadingIndicator>
        ) : list.isError && !list.data ? (
          <ErrorState
            onRetry={() => {
              void list.refetch();
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="아직 알림이 없어요."
            description="새로운 소식이 오면 여기에서 확인할 수 있어요."
          />
        ) : (
          groups.map(([date, entries]) => (
            <section key={date} aria-label={`${formatDate(date)} 알림`} className={styles.group}>
              <h2 className={styles.date}>
                <time dateTime={date}>{formatDate(date)}</time>
              </h2>
              <ul className={styles.list}>
                {entries.map((item) => (
                  <li key={item.id}>
                    <NotificationRow
                      item={item}
                      pending={read.isPending}
                      onOpen={open}
                      onReadInBackground={(id) => {
                        if (!read.isPending)
                          read.mutate({ kind: 'one', id, target: null, appeal: false });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        {list.isError && list.data && (
          <ErrorState
            title="알림 목록을 갱신하지 못했어요"
            onRetry={() => {
              void list.refetch();
            }}
          />
        )}
        {list.hasNextPage && (
          <Button
            variant="soft"
            block
            disabled={list.isFetchingNextPage}
            onClick={() => {
              void list.fetchNextPage();
            }}
            pending={list.isFetchingNextPage}
            pendingLabel="불러오는 중…"
          >
            더 보기
          </Button>
        )}
      </section>
      <AppealSheet key={overlay.id ?? 'closed'} notification={selected} />
    </>
  );
}
