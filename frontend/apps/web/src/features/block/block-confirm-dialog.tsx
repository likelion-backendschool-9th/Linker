'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog';
import { apiFetch } from '@/lib/api/api-fetch';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

type BlockConfirmDialogProps = {
  userId: number;
  /** Display name shown in the question */
  name: string;
  onBlocked?: () => void;
};

/**
 * Block confirm (04 ch. 9 "Blocking"). Mount on screens with a block action and open with
 * `useOverlay('block').open(String(userId))`. The other person isn't notified.
 * `POST /api/v1/user/blocks` (00 BlockController) — swap to the orval hook when it is generated.
 */
export function BlockConfirmDialog({ userId, name, onBlocked }: BlockConfirmDialogProps) {
  const overlay = useOverlay('block');
  const queryClient = useQueryClient();

  const block = useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/v1/user/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      overlay.close();
      toast(`${name}님을 차단했어요.`);
      void queryClient.invalidateQueries();
      onBlocked?.();
    },
  });

  return (
    <ConfirmDialog
      overlay={overlay}
      title={`${name}님을 차단할까요?`}
      description="서로의 글, 댓글, 프로필이 보이지 않고 팔로우가 끊겨요. 1:1 채팅과 지원도 막혀요. 상대에게는 알리지 않아요."
      confirmLabel="차단"
      destructive
      pending={block.isPending}
      onConfirm={() => block.mutate()}
    />
  );
}
