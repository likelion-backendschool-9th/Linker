'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/features/chat/chat-queries';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { leaveRoom, type RoomInfo } from './api';

export function useChatRoomMenu({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const info = useOverlay('chat-info');
  const pullRequests = useOverlay('chat-pull-requests');
  const leaveConfirm = useOverlay('chat-leave');
  const client = useQueryClient();
  const direct = room.kind === 'DIRECT';
  const leave = useMutation({
    mutationFn: () => leaveRoom(room.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: chatKeys.account(login) });
      toast('대화에서 나갔어요.');
      await leaveConfirm.closeThen('/chats');
    },
  });

  return {
    info,
    pullRequests,
    leaveConfirm,
    direct,
    leave,
    leaveDisabled: disabled || leave.isPending,
    onConfirmLeave: () => {
      if (!disabled && !leave.isPending) leave.mutate();
    },
  };
}
