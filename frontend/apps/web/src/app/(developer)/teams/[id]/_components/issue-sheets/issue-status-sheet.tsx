'use client';

// Overlay: change status (07 TODO 12), reused by 13 and the board's "상태 바꾸기" (14)
import { useId, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { ISSUE_STATUS_LABELS, ISSUE_STATUSES, type IssueStatus } from '../../../../_lib/issue-status';
import { saveErrorMessage } from './save-error';
import styles from './issue-sheets.module.css';

type IssueStatusSheetProps = {
  value: IssueStatus;
  /** Rejecting keeps the sheet open with the reason */
  onSave: (status: IssueStatus) => Promise<unknown>;
};

const HINTS: Record<(typeof ISSUE_STATUSES)[number], string> = {
  TODO: '아직 시작하지 않은 일',
  IN_PROGRESS: '지금 하고 있는 일',
  BLOCKED: '막혀서 멈춘 일. 이슈는 열어 두고 "중단"으로 표시해요',
  DONE: '끝난 일. GitHub 이슈도 닫혀요',
};

export function IssueStatusSheet({ value, onSave }: IssueStatusSheetProps) {
  const overlay = useOverlay('issue-status');
  return (
    <OverlaySheet
      overlay={overlay}
      title="상태 바꾸기"
      description="작업 완료로 옮기면 GitHub 이슈가 닫히고, 완료에서 되돌리면 다시 열려요."
    >
      {overlay.isOpen && <StatusForm value={value} onSave={onSave} onDone={overlay.close} />}
    </OverlaySheet>
  );
}

function StatusForm({ value, onSave, onDone }: IssueStatusSheetProps & { onDone: () => void }) {
  const [draft, setDraft] = useState<IssueStatus>(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = useId();

  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        if (draft === value) return onDone();
        setPending(true);
        setError(null);
        try {
          await onSave(draft);
          onDone();
        } catch (failure) {
          setError(saveErrorMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset className={styles.fieldset}>
        <legend className="sr-only">상태</legend>
        <div className={styles.options}>
          {ISSUE_STATUSES.map((status) => (
            <label key={status} className={styles.option}>
              <input
                type="radio"
                name={name}
                value={status}
                className={styles.control}
                checked={draft === status}
                onChange={() => setDraft(status)}
              />
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{ISSUE_STATUS_LABELS[status]}</span>
                <span className={styles.optionHint}>{HINTS[status]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {value === 'OTHER' && (
        <p className={styles.note}>
          지금은 보드의 &quot;기타&quot; 칸에 있어요. 위 네 가지 중 하나로 옮길 수 있어요.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" aria-disabled={pending} pending={pending} pendingLabel="저장하는 중…" >
          저장
        </Button>
      </div>
    </form>
  );
}
