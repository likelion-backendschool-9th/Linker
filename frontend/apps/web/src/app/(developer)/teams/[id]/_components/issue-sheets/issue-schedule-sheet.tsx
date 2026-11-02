'use client';

// Overlay: start and due date (07 TODO 12, POL-I-3), reused by 13
import { useId, useRef, useState } from 'react';

import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { IssueSchedule } from '../../_lib/issue-detail-queries';
import { saveErrorMessage } from './save-error';
import styles from './issue-sheets.module.css';

type IssueScheduleSheetProps = {
  value: IssueSchedule;
  onSave: (schedule: IssueSchedule) => Promise<unknown>;
};

export function IssueScheduleSheet({ value, onSave }: IssueScheduleSheetProps) {
  const overlay = useOverlay('issue-schedule');
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
  const [start, setStart] = useState(value.startDate ?? '');
  const [due, setDue] = useState(value.dueDate ?? '');
  const [orderError, setOrderError] = useState(false);
  // "이미 지난 날짜예요" is asked once, then the same submit goes through (04 ch. 7 exceptions)
  const [pastConfirmed, setPastConfirmed] = useState(false);
  const [askPast, setAskPast] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const dueChanged = due !== (value.dueDate ?? '');
  const duePast = due !== '' && due < todayKst();

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        // Start ≤ due (POL-I-3)
        if (start && due && start > due) {
          setOrderError(true);
          dueRef.current?.focus();
          return;
        }
        if (dueChanged && duePast && !pastConfirmed) {
          setAskPast(true);
          setPastConfirmed(true);
          return;
        }
        setPending(true);
        setError(null);
        try {
          await onSave({ startDate: start || null, dueDate: due || null });
          onDone();
        } catch (failure) {
          setError(saveErrorMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <div className={styles.field}>
        <label htmlFor={`${id}-start`} className={styles.label}>
          시작일
        </label>
        <input
          id={`${id}-start`}
          type="date"
          className={styles.input}
          value={start}
          onChange={(event) => {
            setStart(event.target.value);
            setOrderError(false);
          }}
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
          onChange={(event) => {
            setDue(event.target.value);
            setOrderError(false);
            setAskPast(false);
            setPastConfirmed(false);
          }}
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
        <Button type="submit" aria-disabled={pending} pending={pending} pendingLabel="저장하는 중…" >
          {askPast ? '지난 날짜로 저장' : '저장'}
        </Button>
      </div>
    </form>
  );
}
