'use client';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatDate } from '@/lib/format/time';

import { AppealSheet } from '../appeal-sheet';
import { NotificationRow } from '../notification-row';
import styles from './NotificationList.module.css';
import { useNotificationList } from './hook';

export function NotificationList() {
  const { overlay, list, count, items, groups, read, perform, open, selected } =
    useNotificationList();

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
          <>
            <p role="status">알림을 불러오고 있어요.</p>
            <Skeleton count={3} />
          </>
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
          >
            {list.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </Button>
        )}
      </section>
      <AppealSheet key={overlay.id ?? 'closed'} notification={selected} />
    </>
  );
}
