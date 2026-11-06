'use client';

import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useId, useState, type FormEvent } from 'react';

import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import { issueFilterParsers, type IssueFilters } from '../../_lib/issue-filters';
import { ISSUE_STATUSES } from '../../../../_lib/issue-status';
import { issueFilterOptions } from './api';

const ALL = '';
const CLEARED: IssueFilters = {
  repo: null,
  status: null,
  assignee: null,
  label: null,
  open: false,
};

export function useIssueFilterSheet() {
  return useOverlay('issue-filter');
}

export function useIssueFilterFields({
  teamId,
  overlay,
}: {
  teamId: string;
  overlay: OverlayControl;
}) {
  const [filters, setFilters] = useQueryStates(issueFilterParsers, { history: 'replace' });
  const [draft, setDraft] = useState<IssueFilters>(filters);
  const options = useQuery(issueFilterOptions(teamId));
  const id = useId();
  const field = (name: string) => `${id}-${name}`;
  const change = (patch: Partial<IssueFilters>) =>
    setDraft((current) => ({ ...current, ...patch }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void overlay.closeAnd(() => setFilters({ ...draft, open: draft.open || null }));
  }

  function clear() {
    setDraft(CLEARED);
  }

  function setRepo(value: string) {
    change({ repo: value || null });
  }

  function setStatus(value: string) {
    change({
      status: ISSUE_STATUSES.find((status) => status === value) ?? null,
    });
  }

  function setAssignee(value: string) {
    change({ assignee: value || null });
  }

  function setLabel(value: string) {
    change({ label: value || null });
  }

  function setOpenOnly(checked: boolean) {
    change({ open: checked });
  }

  return {
    draft,
    options,
    field,
    ALL,
    submit,
    clear,
    setRepo,
    setStatus,
    setAssignee,
    setLabel,
    setOpenOnly,
  };
}
