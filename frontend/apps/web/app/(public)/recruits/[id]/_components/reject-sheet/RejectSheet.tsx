'use client';

// Overlay: reject with an optional reason that stays with the author (POL-R-4)
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

import styles from '../detail-sheets.module.css';
import { useRejectForm, useRejectSheet } from './hook';

/** Open with `useOverlay('recruit-reject').open(applicationId)` */
export function RejectSheet({ recruitId }: { recruitId: string }) {
  const overlay = useRejectSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="지원을 거절할까요?"
      description="지원자에게는 '이번엔 함께하지 못하게 됐어요'라고만 보여요."
    >
      {overlay.isOpen && overlay.id && (
        <RejectForm
          key={overlay.id}
          recruitId={recruitId}
          applicationId={Number(overlay.id)}
          overlay={overlay}
        />
      )}
    </OverlaySheet>
  );
}

type RejectFormProps = { recruitId: string; applicationId: number; overlay: OverlayControl };

function RejectForm({ recruitId, applicationId, overlay }: RejectFormProps) {
  const { id, reason, setReason, rejectPending, rejectError, submit, close } = useRejectForm({
    recruitId,
    applicationId,
    overlay,
  });

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor={`${id}-reason`} className={styles.label}>
          거절 사유<span className={styles.optional}> (선택)</span>
        </label>
        <textarea
          id={`${id}-reason`}
          className={styles.textarea}
          rows={4}
          value={reason}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setReason(event.target.value)}
        />
        <p id={`${id}-hint`} className={styles.hint}>
          사유는 나만 볼 수 있어요. 지원자에게 보내지 않아요.
        </p>
      </div>
      {rejectError && (
        <p className={styles.error} role="alert">
          거절하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" onClick={close}>
          취소
        </Button>
        <Button type="submit" variant="danger" aria-disabled={rejectPending}>
          {rejectPending ? '거절하는 중…' : '거절하기'}
        </Button>
      </div>
    </form>
  );
}
