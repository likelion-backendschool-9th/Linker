'use client';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';

import type { RoomInfo } from '../../_lib/room-api';
import styles from '../chat-room/ChatRoom.module.css';

import { useRequestRoomBar } from './hook';

/** Accept or delete a received message request from the top of the room. */
export function RequestRoomBar({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const { overlay, accept, remove, blocked, onAccept, onConfirmDelete } = useRequestRoomBar({
    room,
    login,
    disabled,
  });

  return (
    <>
      <div className={styles.requestBar}>
        <p>요청을 수락하면 대화가 열려요.</p>
        <div className={styles.requestActions}>
          <Button
            variant="outline"
            disabled={blocked}
            aria-label={`${room.title} 요청 삭제`}
            onClick={() => overlay.open(String(room.id))}
          >
            삭제
          </Button>
          <Button
            disabled={blocked}
            aria-label={`${room.title} 요청 수락`}
            onClick={onAccept}
          >
            수락
          </Button>
        </div>
        {accept.isError && (
          <ErrorState title="요청을 처리하지 못했어요" description="잠시 후 다시 시도해 주세요." />
        )}
      </div>
      <ConfirmDialog
        overlay={overlay}
        title="메시지 요청을 삭제할까요?"
        description="상대에게는 삭제 사실을 알리지 않아요."
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        error={remove.isError ? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' : null}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
