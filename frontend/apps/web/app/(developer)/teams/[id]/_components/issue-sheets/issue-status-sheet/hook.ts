'use client';

import { useId, useState, type FormEvent } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

import type { IssueStatus } from '../../../../../_lib/issue-status';
import { saveErrorMessage } from '../save-error';

export function useIssueStatusSheet() {
  return useOverlay('issue-status');
}

export function useIssueStatusForm({
  value,
  onSave,
  onDone,
}: {
  value: IssueStatus;
  onSave: (status: IssueStatus) => Promise<unknown>;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<IssueStatus>(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
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
  }

  return { draft, setDraft, pending, error, name, submit };
}
