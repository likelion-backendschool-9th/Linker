'use client';

import { X } from 'lucide-react';
import { AlertDialog } from 'radix-ui';

import type { OverlayControl } from '@/lib/navigation/use-overlay';

import overlayStyles from '../overlay.module.css';
import styles from '../prompt-dialog.module.css';

type ConfirmDialogProps = {
  overlay: OverlayControl;
  title: string;
  description: string;
  confirmLabel: string;
  /** The dismiss button; most prompts say "취소하기" */
  cancelLabel?: string;
  /** Delete, leave, block: error-colored confirm text */
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
};

/**
 * Centered confirm prompt (same chrome as login 유도 모달). Default focus stays on cancel.
 * Confirm does not auto-close; `onConfirm` closes when the action succeeds.
 */
export function ConfirmDialog({
  overlay,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소하기',
  destructive = false,
  pending = false,
  error = null,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayStyles.scrim} />
        <AlertDialog.Content className={styles.dialog}>
          <div className={styles.header}>
            <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
            <AlertDialog.Cancel type="button" className={styles.close}>
              <X aria-hidden className={styles.closeIcon} strokeWidth={2} />
              <span className="sr-only">닫기</span>
            </AlertDialog.Cancel>
          </div>
          <AlertDialog.Description className={styles.description}>
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={destructive ? styles.confirmDanger : styles.confirm}
              aria-disabled={pending}
              onClick={() => !pending && onConfirm()}
            >
              {confirmLabel}
            </button>
            <AlertDialog.Cancel type="button" className={styles.cancel}>
              {cancelLabel}
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
