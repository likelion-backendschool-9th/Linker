'use client';

import { useQueryStates } from 'nuqs';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { activeFilterCount, issueFilterParsers } from '../../_lib/issue-filters';

export function useIssueFilterButton() {
  const overlay = useOverlay('issue-filter');
  const [filters] = useQueryStates(issueFilterParsers);
  const count = activeFilterCount(filters);

  return {
    count,
    openFilter: () => overlay.open(),
  };
}
