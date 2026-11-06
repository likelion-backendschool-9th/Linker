'use client';

import { useId, useRef, useState, type FormEvent } from 'react';

import { todayKst } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';

import type { IssueSchedule } from '../../../_lib/issue-detail-queries';
import { saveErrorMessage } from '../save-error';

export type IssueScheduleSheetProps = {
  value: IssueSchedule;
  onSave: (schedule: IssueSchedule) => Promise<unknown>;
};

export function useIssueScheduleSheet() {
  return useOverlay('issue-schedule');
}

export function useIssueScheduleForm({
  value,
  onSave,
  onDone,
}: IssueScheduleSheetProps & { onDone: () => void }) {
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
