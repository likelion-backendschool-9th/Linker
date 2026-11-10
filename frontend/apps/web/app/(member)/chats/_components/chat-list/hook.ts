'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  CHAT_TABS,
  chatKeys,
  chatRoomsOptions,
  deleteChatRequest,
  leaveChatRoom,
  markChatRoomRead,
  unreadSummaryOptions,
  type ChatRoom,
  type ChatTab,
  type UnreadSummary,
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

export function useChatList(initialSummary?: UnreadSummary) {
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
  const summary = useQuery({ ...unreadSummaryOptions(viewer.login), initialData: initialSummary });
  const overlay = useOverlay('delete-confirm');
  const deleteOverlay = (id: number) => overlay.open(String(id));
  const refresh = () => client.invalidateQueries({ queryKey: chatKeys.account(viewer.login) });
  const remove = useMutation({
    mutationFn: deleteChatRequest,
    onSuccess: async () => {
      overlay.close();
      toast('메시지 요청을 삭제했어요.');
      await refresh();
    },
  });
  // Row menu (right-click / long press): 방 나가기 · 읽음 처리. Leave confirms in 17's dialog copy.
  const menu = useOverlay('chat-room-menu');
  const leaveConfirm = useOverlay('chat-leave');
  const leave = useMutation({
    mutationFn: leaveChatRoom,
    onSuccess: async () => {
      leaveConfirm.close();
      toast('대화에서 나갔어요.');
      await refresh();
    },
  });
  const read = useMutation({
    mutationFn: (room: ChatRoom) => markChatRoomRead(room.id, room.lastMessage?.id ?? 0),
    onSuccess: async () => {
      menu.close();
      toast('읽음 처리했어요.');
      await refresh();
    },
    onError: () => toast('읽음 처리하지 못했어요. 다시 시도해 주세요.', { tone: 'alert' }),
  });
  // Accepting lives in the room's request panel (17); the list only deletes (Figma 16 has no 수락).
  const pending = remove.isPending || leave.isPending;
  const items = rooms.data?.pages.flatMap((page) => page.items) ?? [];
  const mutationError = remove.error;
  const writeDisabled = pending || viewer.status === 'SUSPENDED';
  const menuRoom = items.find((room) => String(room.id) === menu.id) ?? null;

  return {
    viewer,
    tab,
    tabs,
    setTab,
    rooms,
    summary,
    overlay,
    remove,
    pending,
    items,
    mutationError,
    writeDisabled,
    menu,
    menuRoom,
    leaveConfirm,
    leave,
    read,
    onLeaveFromMenu: (room: ChatRoom) => {
      if (writeDisabled) return;
      if (room.kind === 'TEAM') {
        // Policy: team chat follows team membership, so leaving goes through team settings (09).
        if (room.teamId != null) void menu.closeThen(`/teams/${room.teamId}/settings` as Route);
      } else if (room.kind === 'REQUEST') {
        deleteOverlay(room.id);
      } else {
        leave.reset();
        leaveConfirm.open(String(room.id));
      }
    },
    onReadFromMenu: (room: ChatRoom) => {
      if (room.unreadCount > 0 && room.lastMessage && !read.isPending) read.mutate(room);
    },
    onConfirmLeave: () => {
      const id = Number(leaveConfirm.id);
      if (items.some((room) => room.id === id && room.kind === 'DIRECT') && !writeDisabled)
        leave.mutate(id);
    },
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
