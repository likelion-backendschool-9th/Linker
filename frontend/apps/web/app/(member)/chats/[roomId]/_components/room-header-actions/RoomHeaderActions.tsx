'use client';

import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';
import { Menu } from 'lucide-react';

import { Icon } from '@/components/ui/icon/Icon';

import styles from './RoomHeaderActions.module.css';
import { useRoomHeaderActions } from './hook';

/** Figma 17 header (248:1242): search (team rooms) and ☰, which opens the room info screen. */
export function RoomHeaderActions({ roomId, team }: { roomId: number; team: boolean }) {
  const { openInfo, onSearch } = useRoomHeaderActions(roomId);
  return (
    <div className={styles.actions}>
      {team && (
        <button type="button" className={`${styles.button} ${styles.search}`} onClick={onSearch}>
          <Icon svg={MagnifierLinearIcon} />
          <span className="sr-only">대화 검색</span>
        </button>
      )}
      <button type="button" className={styles.button} aria-haspopup="dialog" onClick={openInfo}>
        <Menu aria-hidden />
        <span className="sr-only">채팅방 정보</span>
      </button>
    </div>
  );
}
