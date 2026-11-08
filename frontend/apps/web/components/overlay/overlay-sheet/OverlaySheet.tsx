'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';

import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from '../overlay.module.css';

type OverlaySheetProps = {
  overlay: OverlayControl;
  title: ReactNode;
  /** Every overlay has a description; pass `describeHidden` when it would only repeat the title */
  description: string;
  describeHidden?: boolean;
  /** Optional in-place trigger; Radix then restores keyboard focus on sheet close. */
  trigger?: ReactElement;
  onOpenAutoFocus?: (event: Event) => void;
  /** Added after the default classes, for a sheet whose page Figma differs from the shared look */
  classNames?: { scrim?: string; sheet?: string; title?: string };
  children?: ReactNode;
};

function withExtra(base: string | undefined, extra: string | undefined) {
  return extra ? `${base} ${extra}` : base;
}

/** Bottom sheet wired to `useOverlay()`; feature sheets only supply content (blueprint §7-3). */
export function OverlaySheet({
  overlay,
  title,
  description,
  describeHidden = false,
  trigger,
  onOpenAutoFocus,
  classNames,
  children,
}: OverlaySheetProps) {
  return (
    <Dialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={withExtra(styles.scrim, classNames?.scrim)} />
        <Dialog.Content
          className={withExtra(styles.sheet, classNames?.sheet)}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div className={styles.header}>
            <Dialog.Title className={withExtra(styles.title, classNames?.title)}>
              {title}
            </Dialog.Title>
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
