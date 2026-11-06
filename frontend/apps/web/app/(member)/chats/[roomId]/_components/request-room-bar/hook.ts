'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { RoomInfo } from '../../_lib/room-api';

import { acceptChatRequest, chatKeys, deleteChatRequest } from './api';

export function useRequestRoomBar({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const overlay = useOverlay('delete-confirm');
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: chatKeys.account(login) });
  const accept = useMutation({
    mutationFn: () => acceptChatRequest(room.id),
    onSuccess: async () => {
      toast('메시지 요청을 수락했어요.');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteChatRequest(room.id),
    onSuccess: async () => {
      toast('메시지 요청을 삭제했어요.');
      await refresh();
      await overlay.closeThen('/chats?tab=REQUEST' as Route);
    },
  });
  const pending = accept.isPending || remove.isPending;
  const blocked = disabled || pending;

  return {
    overlay,
    accept,
    remove,
    pending,
    blocked,
    onAccept: () => accept.mutate(),
    onConfirmDelete: () => {
      if (!blocked && overlay.id === String(room.id)) remove.mutate();
    },
  };
}
