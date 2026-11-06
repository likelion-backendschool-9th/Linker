'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';

import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from '../overlay.module.css';

type OverlayDialogProps = {
  overlay: OverlayControl;
  title: string;
  description: string;
  describeHidden?: boolean;
  children?: ReactNode;
};

/** Centered modal wired to `useOverlay()`. For "are you sure?" use `ConfirmDialog`. */
export function OverlayDialog({
  overlay,
  title,
  description,
  describeHidden = false,
  children,
}: OverlayDialogProps) {
  return (
    <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content className={styles.dialog}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close}>
              <X aria-hidden />
              <span className="sr-only">닫기</span>
            </Dialog.Close>
          </div>
          <Dialog.Description className={describeHidden ? 'sr-only' : styles.description}>
            {description}
          </Dialog.Description>
          {children && <div className={styles.body}>{children}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
