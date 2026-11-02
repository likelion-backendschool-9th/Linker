import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import { issueFilterQuery, type IssueFilters } from '../../_lib/issue-filters';
import type { IssueRow } from '../../_lib/issue-queries';
import type { IssueStatus } from '../../../../_lib/issue-status';

/**
 * Provisional 14 `BoardController` contract (WBS 14). Moves borrow 12's status API.
 * `canWrite` is a proposal beyond WBS (the board needs it to turn drag off, 07 TODO 14).
 */
export type BoardColumn = { status: IssueStatus; label: string; cards: IssueRow[] };
export type Board = { canWrite: boolean; columns: BoardColumn[] };

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
