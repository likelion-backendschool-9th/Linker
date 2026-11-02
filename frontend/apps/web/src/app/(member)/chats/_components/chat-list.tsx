'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  acceptChatRequest,
  CHAT_TABS,
  chatKeys,
  chatRoomsOptions,
  deleteChatRequest,
  unreadSummaryOptions,
  type ChatTab,
} from '@/features/chat/chat-queries';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { ChatRoomRow } from './chat-room-row';
import styles from './chat-list.module.css';

const LABELS: Record<ChatTab, string> = { TEAM: '팀', DIRECT: '개인', REQUEST: '요청' };
const EMPTY: Record<ChatTab, { title: string; description: string }> = {
  TEAM: { title: '아직 팀 채팅이 없어요.', description: '팀에 참여하면 여기서 대화할 수 있어요.' },
  DIRECT: {
    title: '아직 개인 대화가 없어요.',
    description: '프로필에서 메시지를 보내 대화를 시작해 보세요.',
  },
  REQUEST: {
    title: '받은 메시지 요청이 없어요.',
    description: '새로운 요청이 오면 여기에서 확인할 수 있어요.',
  },
};

export function ChatList() {
  const viewer = useViewer();
  const recruiter = viewer.role === 'recruiter';
  const [selected, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(CHAT_TABS).withDefault('TEAM'),
  );
  const tab = recruiter ? 'DIRECT' : selected;
  const tabs = recruiter ? (['DIRECT'] as const) : CHAT_TABS;
  const client = useQueryClient();
  const rooms = useInfiniteQuery(chatRoomsOptions(viewer.login, tab));
  const summary = useQuery(unreadSummaryOptions(viewer.login));
  const overlay = useOverlay('delete-confirm');
  const refresh = () => client.invalidateQueries({ queryKey: chatKeys.account(viewer.login) });
  const accept = useMutation({
    mutationFn: acceptChatRequest,
    onSuccess: async () => {
      toast('메시지 요청을 수락했어요.');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: deleteChatRequest,
    onSuccess: async () => {
      overlay.close();
      toast('메시지 요청을 삭제했어요.');
      await refresh();
    },
  });
  const pending = accept.isPending || remove.isPending;
  const items = rooms.data?.pages.flatMap((page) => page.items) ?? [];
  const mutationError = accept.error || remove.error;

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
      <p role="status" className="sr-only">
        {rooms.isPending ? '채팅 목록을 불러오고 있어요.' : ''}
      </p>
      <section
        aria-label={`${LABELS[tab]} 채팅 목록`}
        aria-busy={rooms.isPending}
        className={styles.content}
      >
        {rooms.isPending ? (
          <LoadingIndicator label="채팅 목록을 불러오고 있어요." variant="block" announce={false}>
            <Skeleton count={3} />
          </LoadingIndicator>
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
                  accepting={accept.isPending && accept.variables === room.id}
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
            pending={rooms.isFetchingNextPage}
            pendingLabel="불러오는 중…"
          >
            더 보기
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
        onConfirm={() => {
          const id = Number(overlay.id);
          if (
            items.some(
              (room) =>
                room.id === id && room.kind === 'REQUEST' && room.requestDirection === 'RECEIVED',
            ) &&
            viewer.status !== 'SUSPENDED' &&
            !pending
          )
            remove.mutate(id);
        }}
      />
    </>
  );
}
