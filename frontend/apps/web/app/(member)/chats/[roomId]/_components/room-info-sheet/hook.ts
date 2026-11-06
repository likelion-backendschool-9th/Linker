'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { setMuted, type RoomInfo } from './api';

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
  const client = useQueryClient();
  const mute = useMutation({
    mutationFn: () => setMuted(room.id, !room.muted),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['chat', login] });
      toast(room.muted ? '알림을 켰어요.' : '알림을 껐어요.');
    },
  });

  return {
    overlay,
    mute,
    muteDisabled: disabled || mute.isPending,
    onToggleMute: () => mute.mutate(),
    members: room.members.filter((member) => member !== null),
  };
}
