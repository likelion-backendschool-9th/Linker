'use client';

// overlay: Figma 29 해지 modal (364:1694), also used for the refund confirm (user decision 2026-11-09)
import { X } from 'lucide-react';
import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';

import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from './ManageConfirmDialog.module.css';

type Props = {
  overlay: OverlayControl;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  /** The thing being canceled or refunded is gone (e.g. a stale link): explain instead of acting */
  unavailable?: string | null;
  onConfirm: () => void;
};

/** Title, ×, text and two text buttons: "취소하기" (blue, default focus) and the action (grey). */
export function ManageConfirmDialog({
  overlay,
  title,
  description,
  confirmLabel,
  pending,
  error,
  unavailable,
  onConfirm,
}: Props) {
  return (
    <AlertDialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.scrim} />
        <AlertDialog.Content className={styles.dialog}>
          <div className={styles.header}>
            <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
            <AlertDialog.Cancel className={styles.close}>
              <X aria-hidden />
              <span className="sr-only">닫기</span>
            </AlertDialog.Cancel>
          </div>
          <AlertDialog.Description asChild>
            <div className={styles.description}>{unavailable ?? description}</div>
          </AlertDialog.Description>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <AlertDialog.Cancel className={styles.cancel}>취소하기</AlertDialog.Cancel>
            {!unavailable && (
              <button
                type="button"
                className={styles.confirm}
                aria-disabled={pending}
                onClick={() => !pending && onConfirm()}
              >
                {pending ? '처리 중이에요' : confirmLabel}
              </button>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
