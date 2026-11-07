'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  acceptChatRequest,
  CHAT_TABS,
  chatKeys,
  chatRoomsOptions,
  deleteChatRequest,
  unreadSummaryOptions,
  type ChatTab,
} from './api';

export const LABELS: Record<ChatTab, string> = { TEAM: '팀', DIRECT: '개인', REQUEST: '요청' };
export const EMPTY: Record<ChatTab, { title: string; description: string }> = {
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

export function useChatList() {
  const viewer = useViewer();
  const recruiter = viewer.role === 'recruiter';
  const [selected, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(CHAT_TABS).withDefault('TEAM'),
  );
  const tab = recruiter ? 'DIRECT' : selected;
  const tabs = recruiter ? (['DIRECT'] as const) : CHAT_TABS;
  const client = useQueryClient();
  const router = useRouter();
  const rooms = useInfiniteQuery(chatRoomsOptions(viewer.login, tab));
  const summary = useQuery(unreadSummaryOptions(viewer.login));
  const overlay = useOverlay('delete-confirm');
  const refresh = () => client.invalidateQueries({ queryKey: chatKeys.account(viewer.login) });
  const accept = useMutation({
    mutationFn: acceptChatRequest,
    // The conversation opens right away in 17; the list and badge refetch in the background.
    onSuccess: ({ roomId }) => {
      toast('메시지 요청을 수락했어요.');
      void refresh();
      router.push(`/chats/${roomId}` as Route);
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

  return {
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
    onConfirmDelete: () => {
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
    },
  };
}
