import { createLoader, parseAsBoolean, parseAsString, parseAsStringLiteral } from 'nuqs/server';

import { ISSUE_STATUSES } from '../../../_lib/issue-status';

/**
 * Issue filters kept in the URL (07 TODO 11). One parser map for the list (11), board (14) and calendar (15),
 * read on the server with `loadIssueFilters` and on the client with `useQueryStates(issueFilterParsers)`.
 */
export const issueFilterParsers = {
  repo: parseAsString,
  status: parseAsStringLiteral(ISSUE_STATUSES),
  assignee: parseAsString,
  label: parseAsString,
  /** Open issues only */
  open: parseAsBoolean.withDefault(false),
};

export const loadIssueFilters = createLoader(issueFilterParsers);

export type IssueFilters = {
  repo: string | null;
  status: (typeof ISSUE_STATUSES)[number] | null;
  assignee: string | null;
  label: string | null;
  open: boolean;
};

/** Query string for the WBS list endpoints (`repo`, `status`, `assignee`, `label`, `open`). */
export function issueFilterQuery(filters: IssueFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.repo) query.set('repo', filters.repo);
  if (filters.status) query.set('status', filters.status);
  if (filters.assignee) query.set('assignee', filters.assignee);
  if (filters.label) query.set('label', filters.label);
  if (filters.open) query.set('open', 'true');
  return query;
}

/** How many filters are set, for the filter button's label */
export function activeFilterCount(filters: IssueFilters): number {
  return [
    filters.repo,
    filters.status,
    filters.assignee,
    filters.label,
    filters.open || null,
  ].filter(Boolean).length;
}
