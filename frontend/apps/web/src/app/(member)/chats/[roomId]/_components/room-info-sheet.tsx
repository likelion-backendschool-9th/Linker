'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { setMuted, type RoomInfo } from '../_lib/room-api';
import styles from './chat-room.module.css';

export function RoomInfoSheet({
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
  return (
    <OverlaySheet overlay={overlay} title="채팅방 정보" description={room.title}>
        <Button
          variant="soft"
          aria-pressed={room.muted}
          disabled={disabled || mute.isPending}
          onClick={() => mute.mutate()}
        >
          {room.muted ? '알림 켜기' : '알림 끄기'}
        </Button>
        {mute.isError && (
          <ErrorState title="알림 설정을 바꾸지 못했어요" onRetry={() => mute.mutate()} />
        )}
        <h2 className={styles.sectionTitle}>참여자</h2>
        <ul>
          {room.members
            .filter((member) => member !== null)
            .map((member) => (
              <li key={member.id} className={styles.member}>
                {member.name}
              </li>
            ))}
        </ul>
    </OverlaySheet>
  );
}
