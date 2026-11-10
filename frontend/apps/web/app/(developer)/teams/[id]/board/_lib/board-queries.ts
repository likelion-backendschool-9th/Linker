import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import { issueFilterQuery, type IssueFilters } from '../../_lib/issue-filters';
import type { IssueRow } from '../../_lib/issue-queries';
import type { BoardStatusColor, IssueStatus } from '../../../../_lib/issue-status';

/**
 * 14 `IssueController` board. Moves borrow 12's status API.
 * `writePermissionReason`: READ_ONLY_TEAM / SUSPENDED / NO_REPOSITORY_WRITE_PERMISSION /
 * GITHUB_PERMISSION_UNAVAILABLE (lookup failed — UI still allows a move; the server decides).
 */
export type BoardColumn = {
  status: IssueStatus;
  statusColor: BoardStatusColor;
  label: string;
  cards: IssueRow[];
};
export type Board = {
  canWrite: boolean;
  writePermissionReason: string | null;
  columns: BoardColumn[];
};

/** Same filters as 11 except status: the columns are the statuses */
export function boardOptions(teamId: string, filters: IssueFilters) {
  const scoped = { ...filters, status: null };
  return queryOptions({
    // Under ['issues', teamId] so every issue change (12, 13) refreshes the board too
    queryKey: ['issues', teamId, 'board', scoped] as const,
    queryFn: ({ signal }) => {
      const query = issueFilterQuery(scoped);
      const search = query.size > 0 ? `?${query}` : '';
      return apiFetch<Board>(`/api/v1/user/teams/${encodeURIComponent(teamId)}/board${search}`, {
        signal,
      });
    },
  });
}
