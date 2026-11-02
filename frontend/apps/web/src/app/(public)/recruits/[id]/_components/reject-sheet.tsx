'use client';

// Overlay: reject with an optional reason that stays with the author (POL-R-4)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import { rejectApplication } from '../_lib/detail-queries';
import styles from './detail-sheets.module.css';

/** Open with `useOverlay('recruit-reject').open(applicationId)` */
export function RejectSheet({ recruitId }: { recruitId: string }) {
  const overlay = useOverlay('recruit-reject');
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
  const id = useId();
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => rejectApplication(recruitId, applicationId, reason),
    onSuccess: async () => {
      overlay.close();
      toast('지원을 거절했어요.');
      await client.invalidateQueries({ queryKey: ['recruits'] });
    },
  });

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!reject.isPending) reject.mutate();
      }}
    >
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
      {reject.isError && (
        <p className={styles.error} role="alert">
          거절하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => overlay.close()}>
          취소
        </Button>
        <Button
          type="submit"
          variant="danger"
          aria-disabled={reject.isPending}
          pending={reject.isPending}
          pendingLabel="거절하는 중…"
        >
          거절하기
        </Button>
      </div>
    </form>
  );
}
