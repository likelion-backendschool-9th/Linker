'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';

import {
  ISSUE_STATUS_LABELS,
  ISSUE_STATUSES,
  boardStatusColorVar,
  type BoardStatusColor,
  type IssueStatus,
} from '../../../../../_lib/issue-status';
import styles from '../issue-sheets.module.css';
import { useIssueStatusForm, useIssueStatusSheet } from './hook';

type IssueStatusSheetProps = {
  value: IssueStatus;
  /** Board mapping colors for the four statuses when the parent already has them (e.g. 14). */
  statusColors?: Partial<Record<(typeof ISSUE_STATUSES)[number], BoardStatusColor>>;
  /** Rejecting keeps the sheet open with the reason */
  onSave: (status: IssueStatus) => Promise<unknown>;
};

const HINTS: Record<(typeof ISSUE_STATUSES)[number], string> = {
  TODO: '아직 시작하지 않은 일',
  IN_PROGRESS: '지금 하고 있는 일',
  BLOCKED: '막혀서 멈춘 일. 이슈는 열어 두고 "중단"으로 표시해요',
  DONE: '끝난 일. GitHub 이슈도 닫혀요',
};

export function IssueStatusSheet({ value, statusColors, onSave }: IssueStatusSheetProps) {
  const overlay = useIssueStatusSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="상태 바꾸기"
      description="작업 완료로 옮기면 GitHub 이슈가 닫히고, 완료에서 되돌리면 다시 열려요."
    >
      {overlay.isOpen && (
        <StatusForm
          value={value}
          statusColors={statusColors}
          onSave={onSave}
          onDone={overlay.close}
        />
      )}
    </OverlaySheet>
  );
}

function StatusForm({
  value,
  statusColors,
  onSave,
  onDone,
}: IssueStatusSheetProps & { onDone: () => void }) {
  const { draft, setDraft, pending, error, name, submit } = useIssueStatusForm({
    value,
    onSave,
    onDone,
  });

  return (
    <form className={styles.form} onSubmit={submit}>
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
                <span className={styles.optionTitle}>
                  <span
                    className={styles.swatch}
                    style={{
                      backgroundColor: boardStatusColorVar(statusColors?.[status]),
                    }}
                    aria-hidden="true"
                  />
                  {ISSUE_STATUS_LABELS[status]}
                </span>
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
        <Button type="submit" aria-disabled={pending}>
          {pending ? '저장하는 중…' : '저장'}
        </Button>
      </div>
    </form>
  );
}
