'use client';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { ConfirmDialog } from '../confirm-dialog';

type DeleteConfirmDialogProps = {
  /** e.g. "게시물을 삭제할까요?" */
  title: string;
  /** What else disappears, e.g. "좋아요와 댓글도 함께 삭제돼요." */
  description: string;
  pending?: boolean;
  /** Receives the overlay `oid` (the item to delete); close the dialog when the deletion succeeds */
  onConfirm: (id: string | null) => void;
};

/** Delete confirm: open with `useOverlay('delete-confirm').open(itemId)`. */
export function DeleteConfirmDialog({
  title,
  description,
  pending,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const overlay = useOverlay('delete-confirm');
  return (
    <ConfirmDialog
      overlay={overlay}
      title={title}
      description={description}
      confirmLabel="삭제"
      destructive
      pending={pending}
      onConfirm={() => onConfirm(overlay.id)}
    />
  );
}
