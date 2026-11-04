'use client';

import { GitPullRequest, Info, MoreVertical } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { RoomInfo } from '../_lib/room-api';
import styles from './chat-room.module.css';

/** Local dropdown near the ⋯ trigger; room info / PR list still open via `useOverlay` sheets. */
export function ChatRoomMenu({ room }: { room: RoomInfo }) {
  const info = useOverlay('chat-info');
  const pullRequests = useOverlay('chat-pull-requests');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          className={styles.menuTrigger}
          aria-label="채팅방 더보기"
          aria-haspopup="menu"
        >
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menuPanel}
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <DropdownMenu.Item
            className={styles.menuItem}
            onSelect={() => info.open(String(room.id))}
          >
            <Info aria-hidden />
            방 정보
          </DropdownMenu.Item>
          {room.team && (
            <DropdownMenu.Item
              className={styles.menuItem}
              onSelect={() => pullRequests.open()}
            >
              <GitPullRequest aria-hidden />
              PR 목록
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
