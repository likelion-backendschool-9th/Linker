'use client';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { useIsClient } from '@/hooks/use-is-client';
import { daysUntil, formatDate } from '@/lib/format/time';

import { NOTIFICATION_TABS, NOTIFICATION_TAB_LABELS } from '../../_lib/notification-tab';
import { AppealSheet } from '../appeal-sheet';
import { NotificationRow } from '../notification-row';
import styles from './NotificationList.module.css';
import { useNotificationList } from './hook';

/** Figma 248:1409 "11월 5일 오늘": the age needs the viewer's clock, so it appears after mount. */
function DayHeading({ date }: { date: string }) {
  const isClient = useIsClient();
  const days = isClient ? -daysUntil(date) : null;
  return (
    <h2 className={styles.date}>
      <time dateTime={date}>{formatDate(date)}</time>
      {days !== null && days >= 0 && (
        <span className={styles.age}>{days === 0 ? '오늘' : `${days}일 전`}</span>
      )}
    </h2>
  );
}

/** 18 notifications (Figma 248:1243): "전체 / 읽지 않음" tabs, "전체 읽기", rows grouped by day. */
export function NotificationList() {
  const { tab, setTab, overlay, list, count, items, groups, read, perform, open, selected } =
    useNotificationList();
  const unread = count.data?.count ?? 0;

  return (
    <>
      {/* Plain buttons like page 19's tabs: Radix Tabs paints the focus ring on every tap in Chrome */}
      <div role="group" aria-label="알림 보기" className={styles.tabs}>
        {NOTIFICATION_TABS.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.tab}
            aria-current={value === tab ? 'page' : undefined}
            onClick={() => {
              void setTab(value === 'unread' ? 'unread' : null);
            }}
          >
            {NOTIFICATION_TAB_LABELS[value]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.readAll}
        disabled={read.isPending || !count.data || unread === 0}
        onClick={() => {
          void perform({ kind: 'all' });
        }}
      >
        전체 읽기
      </button>
      <p role="status" className="sr-only">
        {count.data ? `읽지 않은 알림 ${unread}개` : ''}
      </p>
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
      <section aria-label="알림 목록" aria-busy={list.isPending} className={styles.days}>
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
          tab === 'unread' ? (
            <EmptyState title="읽지 않은 알림이 없어요." />
          ) : (
            <EmptyState
              title="아직 알림이 없어요."
              description="새로운 소식이 오면 여기에서 확인할 수 있어요."
            />
          )
        ) : (
          groups.map(([date, entries]) => (
            <section key={date} aria-label={`${formatDate(date)} 알림`} className={styles.group}>
              <DayHeading date={date} />
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
