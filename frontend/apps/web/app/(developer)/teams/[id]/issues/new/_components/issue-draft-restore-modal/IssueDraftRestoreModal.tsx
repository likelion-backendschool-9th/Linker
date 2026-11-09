'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';

import { useOverlay } from '@/lib/navigation/use-overlay';

import styles from './IssueDraftRestoreModal.module.css';

type IssueDraftRestoreModalProps = {
  onRestore: () => void;
  onDiscard: () => void;
};

/**
 * Issue-create only (Figma 708:2249). Posts/recruits keep `DraftRestoreSheet`.
 * Overlay key `issue-draft-restore` so the shared sheet is untouched.
 */
export function IssueDraftRestoreModal({ onRestore, onDiscard }: IssueDraftRestoreModalProps) {
  const overlay = useOverlay('issue-draft-restore');
  return (
    <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content className={styles.dialog}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>이어 쓰기</Dialog.Title>
            <Dialog.Close className={styles.close}>
              <X aria-hidden className={styles.closeIcon} strokeWidth={2} />
              <span className="sr-only">닫기</span>
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.description}>
            이어서 쓸까요? 새로 쓰면 저장된 기존 내용은 지워져요
          </Dialog.Description>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.discard}
              onClick={() => {
                onDiscard();
                overlay.close();
              }}
            >
              새로쓰기
            </button>
            <button
              type="button"
              className={styles.restore}
              onClick={() => {
                // Close first — history.back() would undo setNav from onRestore
                void overlay.closeAnd(() => {
                  onRestore();
                });
              }}
            >
              이어쓰기
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
