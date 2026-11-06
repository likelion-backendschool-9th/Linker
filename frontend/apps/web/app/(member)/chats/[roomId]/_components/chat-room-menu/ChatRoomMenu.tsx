'use client';

import { GitPullRequest, Info, LogOut, MoreVertical } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { Button } from '@/components/ui/button/Button';

import type { RoomInfo } from '../../_lib/room-api';
import styles from '../chat-room/ChatRoom.module.css';

import { useChatRoomMenu } from './hook';

/** Local dropdown near the ⋯ trigger; room info / PR list / leave still open via `useOverlay`. */
export function ChatRoomMenu({
  room,
  login,
  disabled,
}: {
  room: RoomInfo;
  login: string | null;
  disabled: boolean;
}) {
  const {
    info,
    pullRequests,
    leaveConfirm,
    direct,
    leave,
    leaveDisabled,
    onConfirmLeave,
  } = useChatRoomMenu({ room, login, disabled });

  return (
    <>
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
            {direct && (
              <DropdownMenu.Item
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                disabled={leaveDisabled}
                onSelect={() => leaveConfirm.open(String(room.id))}
              >
                <LogOut aria-hidden />
                대화 나가기
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {direct && (
        <ConfirmDialog
          overlay={leaveConfirm}
          title="대화에서 나갈까요?"
          description="내 채팅 목록에서 이 대화가 사라져요. 상대도 나가면 대화가 삭제돼요."
          confirmLabel="나가기"
          destructive
          pending={leave.isPending}
          error={leave.isError ? '대화에서 나가지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.' : null}
          onConfirm={onConfirmLeave}
        />
      )}
    </>
  );
}
