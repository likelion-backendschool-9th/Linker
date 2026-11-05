'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { acceptChatRequest, chatKeys, deleteChatRequest } from '@/features/chat/chat-queries';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import type { RoomInfo } from '../_lib/room-api';
import styles from './chat-room.module.css';

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
  const overlay = useOverlay('delete-confirm');
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: chatKeys.account(login) });
  const accept = useMutation({
    mutationFn: () => acceptChatRequest(room.id),
    onSuccess: async () => {
      toast('메시지 요청을 수락했어요.');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteChatRequest(room.id),
    onSuccess: async () => {
      toast('메시지 요청을 삭제했어요.');
      await refresh();
      await overlay.closeThen('/chats?tab=REQUEST' as Route);
    },
  });
  const pending = accept.isPending || remove.isPending;
  const blocked = disabled || pending;

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
            onClick={() => accept.mutate()}
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
        onConfirm={() => {
          if (!blocked && overlay.id === String(room.id)) remove.mutate();
        }}
      />
    </>
  );
}
