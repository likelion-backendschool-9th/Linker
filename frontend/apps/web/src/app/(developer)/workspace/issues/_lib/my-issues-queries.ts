import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import type { IssueStatus } from '../../../_lib/issue-status';

/**
 * Provisional 07 `WorkspaceController` method `GET /api/v1/user/me/issues` (WBS 07, added by C):
 * open issues assigned to me across all teams, by due date (ERD I-5). `repoName` is a proposal.
 */
export type MyIssue = {
  id: number;
  teamId: number;
  teamName: string;
  repoName: string;
  number: number;
  title: string;
  status: IssueStatus;
  /** `yyyy-MM-dd` in KST; null = no due date (listed last) */
  dueDate: string | null;
  overdue: boolean;
};

export function myIssuesOptions() {
  return queryOptions({
    // Under ['issues'] so changes in any team (12–15) refresh it
    queryKey: ['issues', 'me'] as const,
    queryFn: ({ signal }) => apiFetch<{ items: MyIssue[] }>('/api/v1/user/me/issues', { signal }),
  });
}
