'use client';

import { X } from 'lucide-react';
import { AlertDialog } from 'radix-ui';

import overlayStyles from '@/components/overlay/overlay.module.css';
import promptStyles from '@/components/overlay/prompt-dialog.module.css';
import { useOverlay } from '@/lib/navigation/use-overlay';

type DraftRestoreSheetProps = {
  onRestore: () => void;
  onDiscard: () => void;
};

/**
 * "Restore draft" (07 TODO 00) — Figma 708:2240 "이어 쓰기": the centered prompt modal (same chrome
 * as the login prompt), "새로쓰기" in blue then "이어쓰기" in gray. The writing screen opens it with
 * `useOverlay('draft-restore').open()` when `useDraft(key).load()` returns a value; × or the scrim
 * just closes it and keeps the draft for next time.
 */
export function DraftRestoreSheet({ onRestore, onDiscard }: DraftRestoreSheetProps) {
  const overlay = useOverlay('draft-restore');

  function choose(action: () => void) {
    action();
    overlay.close();
  }

  return (
    <AlertDialog.Root open={overlay.isOpen} onOpenChange={overlay.onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayStyles.scrim} />
        <AlertDialog.Content className={promptStyles.dialog}>
          <div className={promptStyles.header}>
            <AlertDialog.Title className={promptStyles.title}>이어 쓰기</AlertDialog.Title>
            <AlertDialog.Cancel type="button" className={promptStyles.close}>
              <X aria-hidden className={promptStyles.closeIcon} strokeWidth={2} />
              <span className="sr-only">닫기</span>
            </AlertDialog.Cancel>
          </div>
          <AlertDialog.Description className={promptStyles.description}>
            이어서 쓸까요? 새로 쓰면 저장된 기존 내용은 지워져요
          </AlertDialog.Description>
          <div className={promptStyles.actions}>
            <button
              type="button"
              className={promptStyles.confirm}
              onClick={() => choose(onDiscard)}
            >
              새로쓰기
            </button>
            <button type="button" className={promptStyles.cancel} onClick={() => choose(onRestore)}>
              이어쓰기
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
