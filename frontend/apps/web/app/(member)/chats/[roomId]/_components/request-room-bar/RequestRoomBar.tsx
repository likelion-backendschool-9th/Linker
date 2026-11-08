'use client';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { BlockConfirmDialog } from '@/features/block/block-confirm-dialog/BlockConfirmDialog';

import type { RoomInfo } from '../../_lib/room-api';
import styles from './RequestRoomBar.module.css';
import { useRequestRoomBar } from './hook';

/**
 * Figma 17-요청 채팅 (350:123): the panel that replaces the composer while a 1:1 request is open.
 * Received: title, blue guide, 수락 / 거절 / 차단. Sent: only the "상대가 수락하면" guide.
 */
export function RequestRoomBar({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const {
    overlay,
    block,
    accept,
    remove,
    blocked,
    counterpart,
    onAccept,
    onConfirmDelete,
    onBlocked,
  } = useRequestRoomBar({ room, login, disabled });

  if (room.requestDirection !== 'RECEIVED')
    return (
      <div className={styles.panel}>
        <p className={styles.title}>상대가 수락하면 대화가 열려요</p>
      </div>
    );

  return (
    <>
      <section className={styles.panel} aria-label="메시지 요청">
        <p className={styles.title}>{room.title}님이 메시지 요청을 보냈어요</p>
        <p className={styles.guide}>수락 버튼을 누르시면 대화하실 수 있습니다</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={blocked}
            aria-label={`${room.title} 요청 수락`}
            onClick={onAccept}
          >
            수락
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.danger}`}
            disabled={blocked}
            aria-label={`${room.title} 요청 거절`}
            onClick={() => overlay.open(String(room.id))}
          >
            거절
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.danger}`}
            disabled={blocked || !counterpart}
            aria-label={`${room.title}님 차단`}
            onClick={() => counterpart && block.open(String(counterpart.id))}
          >
            차단
          </button>
        </div>
        {accept.isError && (
          <ErrorState title="요청을 처리하지 못했어요" description="잠시 후 다시 시도해 주세요." />
        )}
      </section>
      <ConfirmDialog
        overlay={overlay}
        title="메시지 요청을 거절할까요?"
        description="상대에게는 거절 사실을 알리지 않아요."
        confirmLabel="거절"
        destructive
        pending={remove.isPending}
        error={remove.isError ? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' : null}
        onConfirm={onConfirmDelete}
      />
      {counterpart && (
        <BlockConfirmDialog userId={counterpart.id} name={counterpart.name} onBlocked={onBlocked} />
      )}
    </>
  );
}
