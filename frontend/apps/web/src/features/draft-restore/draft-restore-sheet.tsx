'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from './draft-restore-sheet.module.css';

type DraftRestoreSheetProps = {
  onRestore: () => void;
  onDiscard: () => void;
};

/**
 * "Restore draft" (07 TODO 00). The writing screen opens it with `useOverlay('draft-restore').open()`
 * when `useDraft(key).load()` returns a value.
 */
export function DraftRestoreSheet({ onRestore, onDiscard }: DraftRestoreSheetProps) {
  const overlay = useOverlay('draft-restore');
  return (
    <OverlaySheet
      overlay={overlay}
      title="작성하던 내용이 있어요"
      description="이어서 쓸까요? 새로 쓰면 저장된 내용은 지워져요."
    >
      <div className={styles.actions}>
        <Button
          variant="outline"
          block
          onClick={() => {
            onDiscard();
            overlay.close();
          }}
        >
          새로 쓰기
        </Button>
        <Button
          block
          onClick={() => {
            onRestore();
            overlay.close();
          }}
        >
          이어 쓰기
        </Button>
      </div>
    </OverlaySheet>
  );
}
