'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/features/chat/chat-queries';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { leaveRoom, setMuted, type RoomInfo } from './api';

export function useRoomInfoSheet({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const overlay = useOverlay('chat-info');
  const pullRequests = useOverlay('chat-pull-requests');
  const leaveConfirm = useOverlay('chat-leave');
  const client = useQueryClient();
  const direct = room.kind === 'DIRECT';
  const mute = useMutation({
    mutationFn: () => setMuted(room.id, !room.muted),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['chat', login] });
      toast(room.muted ? '알림을 켰어요.' : '알림을 껐어요.');
    },
  });
  const leave = useMutation({
    mutationFn: () => leaveRoom(room.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: chatKeys.account(login) });
      toast('대화에서 나갔어요.');
      await leaveConfirm.closeThen('/chats');
    },
  });

  return {
    overlay,
    pullRequests,
    leaveConfirm,
    direct,
    mute,
    muteDisabled: disabled || mute.isPending,
    onToggleMute: () => mute.mutate(),
    leave,
    leaveDisabled: disabled || leave.isPending,
    onConfirmLeave: () => {
      if (!disabled && !leave.isPending) leave.mutate();
    },
    members: room.members.filter((member) => member !== null),
  };
}
