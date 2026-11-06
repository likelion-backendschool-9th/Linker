'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';

import type { RoomInfo } from '../../_lib/room-api';
import styles from '../chat-room/ChatRoom.module.css';

import { useRoomInfoSheet } from './hook';

export function RoomInfoSheet({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const { overlay, mute, muteDisabled, onToggleMute, members } = useRoomInfoSheet({
    room,
    login,
    disabled,
  });

  return (
    <OverlaySheet overlay={overlay} title="채팅방 정보" description={room.title}>
      <Button
        variant="soft"
        aria-pressed={room.muted}
        disabled={muteDisabled}
        onClick={onToggleMute}
      >
        {room.muted ? '알림 켜기' : '알림 끄기'}
      </Button>
      {mute.isError && (
        <ErrorState title="알림 설정을 바꾸지 못했어요" onRetry={onToggleMute} />
      )}
      <h2 className={styles.sectionTitle}>참여자</h2>
      <ul>
        {members.map((member) => (
          <li key={member.id} className={styles.member}>
            {member.name}
          </li>
        ))}
      </ul>
    </OverlaySheet>
  );
}
