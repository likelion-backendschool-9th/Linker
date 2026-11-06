'use client';

import { AlertDialog } from 'radix-ui';

import { Button } from '@/components/ui/button/Button';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from '../overlay.module.css';

type ConfirmDialogProps = {
  overlay: OverlayControl;
  title: string;
  description: string;
  confirmLabel: string;
  /** Delete, leave, block: error-colored confirm button */
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
};

/**
 * Confirm modal (blueprint §6-4): Radix AlertDialog, default focus on "취소".
 * The confirm button doesn't close by itself; `onConfirm` closes when the action succeeds.
 */
export function ConfirmDialog({
  overlay,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  error = null,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.scrim} />
        <AlertDialog.Content className={styles.dialog}>
          <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <AlertDialog.Cancel asChild>
              <Button variant="outline">취소</Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              aria-disabled={pending}
              onClick={() => !pending && onConfirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
