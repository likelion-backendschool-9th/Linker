'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import type { ChatRoom } from './api';
import styles from './ChatRoomMenu.module.css';
import { menuTitle, roomMenuItems } from './hook';

type Props = {
  overlay: OverlayControl;
  /** The row the sheet was opened for; null while the list is loading or the room left the page */
  room: ChatRoom | null;
  /** Leave/delete are writes a suspended viewer can't make; reading stays allowed */
  writeDisabled: boolean;
  readPending: boolean;
  onLeave: (room: ChatRoom) => void;
  onRead: (room: ChatRoom) => void;
};

/**
 * Row menu for the 16 chat list (right-click, the keyboard menu key, or a long press on a row).
 * Same look as the 19 single-select sheet (Figma 352:958): 18px title, hairline rows, "완료".
 * "상단 고정" from the reference image is not built (no API or policy for pinning).
 */
export function ChatRoomMenu({ overlay, room, ...actions }: Props) {
  return (
    <OverlaySheet
      overlay={overlay}
      title={room ? menuTitle(room) : '채팅방'}
      description="채팅방에 사용할 기능을 선택해 주세요."
      describeHidden
      classNames={{ title: styles.title }}
    >
      {room ? (
        <MenuItems room={room} {...actions} />
      ) : (
        <p role="status" className={styles.empty}>
          채팅방을 찾지 못했어요.
        </p>
      )}
      <button type="button" className={styles.cta} onClick={() => overlay.close()}>
        완료
      </button>
    </OverlaySheet>
  );
}

function MenuItems({
  room,
  writeDisabled,
  readPending,
  onLeave,
  onRead,
}: Omit<Props, 'overlay' | 'room'> & { room: ChatRoom }) {
  const items = roomMenuItems(room);
  return (
    <ul className={styles.list}>
      {items.leave && (
        <li>
          <button
            type="button"
            className={styles.option}
            disabled={writeDisabled}
            onClick={() => onLeave(room)}
          >
            {items.leave}
          </button>
        </li>
      )}
      <li>
        <button
          type="button"
          className={styles.option}
          disabled={!items.read || readPending}
          onClick={() => onRead(room)}
        >
          읽음 처리
        </button>
      </li>
    </ul>
  );
}
