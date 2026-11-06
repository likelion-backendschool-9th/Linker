'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

import type { IssueLabel } from '../../../_lib/issue-queries';
import { saveErrorMessage } from '../save-error';

type LabelOptions = { items: IssueLabel[] };

export type IssueLabelSheetProps<Key extends readonly unknown[]> = {
  value: IssueLabel[];
  /** The repo's labels: 12's `label-options` */
  options: UseQueryOptions<LabelOptions, Error, LabelOptions, Key>;
  onSave: (labels: string[]) => Promise<unknown>;
};

export function useIssueLabelSheet() {
  return useOverlay('issue-labels');
}

export function useIssueLabelForm<Key extends readonly unknown[]>({
  value,
  options,
  onSave,
  onDone,
}: IssueLabelSheetProps<Key> & { onDone: () => void }) {
  const query = useQuery(options);
  const [selected, setSelected] = useState<string[]>(() => value.map((label) => label.name));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, name] : current.filter((label) => label !== name),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onSave(selected);
      onDone();
    } catch (failure) {
      setError(saveErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return { query, selected, pending, error, toggle, submit };
}
