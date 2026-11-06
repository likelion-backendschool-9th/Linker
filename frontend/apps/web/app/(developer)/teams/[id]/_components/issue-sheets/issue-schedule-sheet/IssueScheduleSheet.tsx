'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';

import styles from '../issue-sheets.module.css';
import {
  useIssueScheduleForm,
  useIssueScheduleSheet,
  type IssueScheduleSheetProps,
} from './hook';

export function IssueScheduleSheet({ value, onSave }: IssueScheduleSheetProps) {
  const overlay = useIssueScheduleSheet();
  return (
    <OverlaySheet
      overlay={overlay}
      title="시작일·마감일"
      description="마감일이 없으면 캘린더 대신 '일정 없음' 목록에 보여요."
    >
      {overlay.isOpen && <ScheduleForm value={value} onSave={onSave} onDone={overlay.close} />}
    </OverlaySheet>
  );
}

function ScheduleForm({ value, onSave, onDone }: IssueScheduleSheetProps & { onDone: () => void }) {
  const {
    start,
    due,
    orderError,
    askPast,
    pending,
    error,
    dueRef,
    id,
    onStartChange,
    onDueChange,
    submit,
  } = useIssueScheduleForm({ value, onSave, onDone });

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <div className={styles.field}>
        <label htmlFor={`${id}-start`} className={styles.label}>
          시작일
        </label>
        <input
          id={`${id}-start`}
          type="date"
          className={styles.input}
          value={start}
          onChange={(event) => onStartChange(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-due`} className={styles.label}>
          마감일
        </label>
        <input
          ref={dueRef}
          id={`${id}-due`}
          type="date"
          className={styles.input}
          value={due}
          aria-invalid={orderError}
          aria-describedby={orderError ? `${id}-order` : undefined}
          onChange={(event) => onDueChange(event.target.value)}
        />
        {orderError && (
          <p id={`${id}-order`} className={styles.error}>
            마감일은 시작일과 같거나 그 뒤여야 해요.
          </p>
        )}
      </div>
      <p className={styles.note}>한국 시간 기준이에요. 날짜를 지우면 일정이 없는 이슈가 돼요.</p>
      {askPast && (
        <p className={styles.warning} role="alert">
          이미 지난 날짜예요. 이대로 저장하려면 한 번 더 눌러 주세요.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" aria-disabled={pending}>
          {pending ? '저장하는 중…' : askPast ? '지난 날짜로 저장' : '저장'}
        </Button>
      </div>
    </form>
  );
}
