'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';
import { ISSUE } from '@/lib/policy';

import type { AssigneeCandidates } from '../../../_lib/issue-detail-queries';
import type { IssueAssignee } from '../../../_lib/issue-queries';
import { saveErrorMessage } from '../save-error';

export type IssueAssigneeSheetProps<Key extends readonly unknown[]> = {
  value: IssueAssignee[];
  /** Who can be picked: 12's `assignee-candidates` */
  candidates: UseQueryOptions<AssigneeCandidates, Error, AssigneeCandidates, Key>;
  onSave: (userIds: number[]) => Promise<unknown>;
};

export function useIssueAssigneeSheet() {
  return useOverlay('issue-assignees');
}

export function useIssueAssigneeForm<Key extends readonly unknown[]>({
  value,
  candidates,
  onSave,
  onDone,
}: IssueAssigneeSheetProps<Key> & { onDone: () => void }) {
  const query = useQuery(candidates);
  const [selected, setSelected] = useState<number[]>(() => value.map((user) => user.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = query.data?.max ?? ISSUE.assigneesMax;

  // Current assignees who can't be picked now (left the team, or haven't accepted the GitHub org
  // invite) stay listed and checked, so saving never drops them silently (04 ch. 7 exceptions)
  const kept = value.filter((user) => !query.data?.items.some((item) => item.id === user.id));
  const rows = query.data
    ? [
        ...query.data.items.map((user) => ({ user, hint: `@${user.login}` })),
        ...kept.map((user) => ({
          user,
          hint: `@${user.login} · ${user.inTeam ? 'GitHub 조직 초대 수락 전' : '팀 밖 사용자'}`,
        })),
      ]
    : [];
  const full = selected.length >= max;

  function toggle(userId: number, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
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

  return { query, selected, pending, error, max, rows, full, toggle, submit };
}
