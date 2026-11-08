'use client';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { ChatRoomRow } from '../chat-room-row';
import styles from './ChatList.module.css';
import { EMPTY, LABELS, useChatList } from './hook';
import type { UnreadSummary } from './api';

export function ChatList({ initialSummary }: { initialSummary?: UnreadSummary }) {
  const {
    viewer,
    tab,
    tabs,
    setTab,
    rooms,
    summary,
    overlay,
    accept,
    remove,
    pending,
    items,
    mutationError,
    onConfirmDelete,
  } = useChatList(initialSummary);

  return (
    <>
      <nav aria-label="채팅 종류" className={styles.tabs}>
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={tab === item}
            className={styles.tab}
            onClick={() => {
              void setTab(item);
            }}
          >
            {LABELS[item]}
            {item === 'REQUEST' && summary.data && (
              <span
                className={styles.count}
                aria-label={`받은 요청 ${summary.data.requestCount}건`}
              >
                {summary.data.requestCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      {summary.isError && (
        <ErrorState
          title="요청 건수를 불러오지 못했어요"
          onRetry={() => {
            void summary.refetch();
          }}
        />
      )}
      {mutationError && (
        <ErrorState title="요청을 처리하지 못했어요" description="잠시 후 다시 시도해 주세요." />
      )}
      <section
        aria-label={`${LABELS[tab]} 채팅 목록`}
        aria-busy={rooms.isPending}
        className={styles.content}
      >
        {rooms.isPending ? (
          <>
            <p role="status">채팅 목록을 불러오고 있어요.</p>
            <Skeleton count={3} />
          </>
        ) : rooms.isError && !rooms.data ? (
          <ErrorState
            onRetry={() => {
              void rooms.refetch();
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState {...EMPTY[tab]} />
        ) : (
          <ul className={styles.list}>
            {items.map((room) => (
              <li key={room.id}>
                <ChatRoomRow
                  room={room}
                  disabled={pending || viewer.status === 'SUSPENDED'}
                  onAccept={() => accept.mutate(room.id)}
                  onDelete={() => overlay.open(String(room.id))}
                />
              </li>
            ))}
          </ul>
        )}
        {rooms.isError && rooms.data && (
          <ErrorState
            title="목록을 갱신하지 못했어요"
            onRetry={() => {
              void rooms.refetch();
            }}
          />
        )}
        {rooms.hasNextPage && (
          <Button
            variant="soft"
            block
            disabled={rooms.isFetchingNextPage}
            onClick={() => {
              void rooms.fetchNextPage();
            }}
          >
            {rooms.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </Button>
        )}
      </section>
      <ConfirmDialog
        overlay={overlay}
        title="메시지 요청을 삭제할까요?"
        description="상대에게는 삭제 사실을 알리지 않아요."
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
