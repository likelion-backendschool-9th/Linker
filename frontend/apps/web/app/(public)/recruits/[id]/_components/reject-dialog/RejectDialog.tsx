'use client';

// Overlay: confirm a reject. No reason is asked (POL-R-4); the applicant only sees the fixed copy
import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';

import { useRejectDialog } from './hook';

/** Open with `useOverlay('recruit-reject').open(applicationId)` */
export function RejectDialog({ recruitId }: { recruitId: string }) {
  const { overlay, pending, error, confirm } = useRejectDialog(recruitId);

  return (
    <ConfirmDialog
      overlay={overlay}
      title="지원을 거절할까요?"
      description="지원자에게는 '이번엔 함께하지 못하게 됐어요'라고만 보여요."
      confirmLabel="거절하기"
      destructive
      pending={pending}
      error={error}
      onConfirm={confirm}
    />
  );
}
