'use client';

import { useId, useRef, useState, type FormEvent } from 'react';

import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { IssueSchedule } from '../../../_lib/issue-detail-queries';
import { saveErrorMessage } from '../save-error';

export type SchedulePart = 'start' | 'due';

export type IssueScheduleSheetProps = {
  value: IssueSchedule;
  /** Which date this opening edits. The other date stays as it was. */
  part?: SchedulePart;
  onSave: (schedule: IssueSchedule) => Promise<unknown>;
};

export function useIssueScheduleSheet() {
  return useOverlay('issue-schedule');
}

export function useIssueScheduleForm({
  value,
  part = 'start',
  onSave,
  onDone,
}: IssueScheduleSheetProps & { onDone: () => void }) {
  // Empty field shows "today" on the wheel — keep state in sync (start used to stay '')
  const [start, setStart] = useState(() =>
    value.startDate ?? (part === 'start' ? todayKst() : ''),
  );
  const [due, setDue] = useState(() => value.dueDate ?? (part === 'due' ? todayKst() : ''));
  const [orderError, setOrderError] = useState(false);
  // "이미 지난 날짜예요" is asked once, then the same submit goes through (04 ch. 7 exceptions)
  const [pastConfirmed, setPastConfirmed] = useState(false);
  const [askPast, setAskPast] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dueRef = useRef<HTMLElement>(null);
  const id = useId();

  function onStartChange(next: string) {
    setStart(next);
    setOrderError(false);
  }

  function onDueChange(next: string) {
    setDue(next);
    setOrderError(false);
    setAskPast(false);
    setPastConfirmed(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // Match the wheel: empty edited part still displays today
    const nextStart = start || (part === 'start' ? todayKst() : '');
    const nextDue = due || (part === 'due' ? todayKst() : '');
    if (nextStart !== start) setStart(nextStart);
    if (nextDue !== due) setDue(nextDue);
    // Start ≤ due (POL-I-3)
    if (nextStart && nextDue && nextStart > nextDue) {
      setOrderError(true);
      dueRef.current?.focus();
      return;
    }
    const dueChanged = nextDue !== (value.dueDate ?? '');
    const duePast = nextDue !== '' && nextDue < todayKst();
    if (dueChanged && duePast && !pastConfirmed) {
      setAskPast(true);
      setPastConfirmed(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({ startDate: nextStart || null, dueDate: nextDue || null });
      onDone();
    } catch (failure) {
      setError(saveErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return {
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
  };
}
