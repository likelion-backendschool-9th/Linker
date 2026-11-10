'use client';

import { sheetClassNames } from '../sheet-class-names';
import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import styles from '../issue-sheets.module.css';
import { useIssueAssigneeForm, useIssueAssigneeSheet, type IssueAssigneeSheetProps } from './hook';

export function IssueAssigneeSheet<Key extends readonly unknown[]>({
  value,
  candidates,
  onSave,
}: IssueAssigneeSheetProps<Key>) {
  const overlay = useIssueAssigneeSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="이슈 담당자"
      description="이슈 담당자"
      describeHidden
      classNames={sheetClassNames}
    >
      {overlay.isOpen && (
        <AssigneeForm
          value={value}
          candidates={candidates}
          onSave={onSave}
          onDone={overlay.close}
        />
      )}
    </OverlaySheet>
  );
}

function AssigneeForm<Key extends readonly unknown[]>({
  value,
  candidates,
  onSave,
  onDone,
}: IssueAssigneeSheetProps<Key> & { onDone: () => void }) {
  const { query, selected, pending, error, max, rows, full, toggle, submit } = useIssueAssigneeForm(
    { value, candidates, onSave, onDone },
  );

  if (query.isError) {
    return (
      <ErrorState
        title="담당자 목록을 불러오지 못했어요"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) {
    return (
      <div aria-busy="true">
        <p role="status">담당자 목록을 불러오고 있어요.</p>
        <Skeleton variant="line" count={3} />
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fieldset}>
        <legend className="sr-only">담당자 고르기</legend>
        {rows.length === 0 ? (
          <p className={styles.note}>고를 수 있는 팀원이 없어요.</p>
        ) : (
          <div className={styles.rows}>
            {rows.map(({ user, hint }) => {
              const checked = selected.includes(user.id);
              return (
                <label key={user.id} className={styles.option}>
                  <input
                    type="checkbox"
                    className={styles.control}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={(event) => toggle(user.id, event.target.checked)}
                  />
                  <span className={styles.person}>{user.name}</span>
                  {user.jobRole ? (
                    <span className={styles.jobRole}>{user.jobRole}</span>
                  ) : null}
                  <span className="sr-only">{hint}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <p className="sr-only" aria-live="polite">
        {selected.length}/{max}명 선택{full ? ' · 더 고르려면 한 명을 빼 주세요.' : ''}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={styles.save} aria-disabled={pending}>
        {pending ? '저장하는 중…' : '완료'}
      </button>
    </form>
  );
}
