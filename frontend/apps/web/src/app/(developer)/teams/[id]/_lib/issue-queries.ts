import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import { issueFilterQuery, type IssueFilters } from './issue-filters';
import type { IssueStatus } from '../../../_lib/issue-status';

/**
 * Provisional 11 `IssueListController` contract (WBS 11). Hand-written until the controller is in
 * OpenAPI; then replace with the orval `p11-issue-list` hooks.
 */

export type IssueUser = { id: number; login: string; name: string; avatarUrl: string };
export type IssueLabel = { name: string; color: string };
/** `inTeam: false` = assigned on GitHub but no longer a team member → "팀 밖 사용자" (04 ch. 7 exceptions) */
export type IssueAssignee = IssueUser & { inTeam: boolean };

/** List row; the board (14) reuses it as its card */
export type IssueRow = {
  id: number;
  number: number;
  repoId: number;
  repoName: string;
  title: string;
  status: IssueStatus;
  state: 'OPEN' | 'CLOSED';
  assignees: IssueAssignee[];
  labels: IssueLabel[];
  /** `yyyy-MM-dd` in KST */
  startDate: string | null;
  dueDate: string | null;
  overdue: boolean;
  /** In the team's GitHub Projects board; false → "일정 없음" */
  inProject: boolean;
  /** Date or status didn't reach GitHub (04 ch. 7 "Sync") */
  scheduleSyncFailed: boolean;
};

export type IssuePage = {
  items: IssueRow[];
  nextCursor: string | null;
  total: number;
  /** Repo write permission and an active team: shows "이슈 작성" and "프로젝트에 추가" (POL-I-2) */
  canWrite: boolean;
};

export type IssueFilterOptions = {
  repos: { id: number; name: string }[];
  labels: IssueLabel[];
  members: IssueUser[];
  statuses: IssueStatus[];
};

export type IssueListView = 'all' | 'unscheduled';

export const issueKeys = {
  team: (teamId: string) => ['issues', teamId] as const,
  list: (teamId: string, view: IssueListView, filters: IssueFilters) =>
    ['issues', teamId, 'list', view, filters] as const,
  filterOptions: (teamId: string) => ['issues', teamId, 'filter-options'] as const,
};

const base = (teamId: string) => `/api/v1/user/teams/${encodeURIComponent(teamId)}`;

/** All issues (filtered) or the "일정 없음" tab: not on the board or no due date (POL-I-3) */
export function issueListOptions(teamId: string, view: IssueListView, filters: IssueFilters) {
  return infiniteQueryOptions({
    queryKey: issueKeys.list(teamId, view, filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = view === 'all' ? issueFilterQuery(filters) : new URLSearchParams();
      if (pageParam !== null) query.set('cursor', pageParam);
      const search = query.size > 0 ? `?${query}` : '';
      const path = view === 'all' ? '/issues' : '/issues/unscheduled';
      return apiFetch<IssuePage>(`${base(teamId)}${path}${search}`, { signal });
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** Choices of the filter sheet; also used by 14 and 15 */
export function issueFilterOptions(teamId: string) {
  return queryOptions({
    queryKey: issueKeys.filterOptions(teamId),
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      apiFetch<IssueFilterOptions>(`${base(teamId)}/issue-filters`, { signal }),
  });
}

/**
 * Re-fetch only this screen's issues from GitHub (once a minute, 04 ch. 7 "Sync"): the current tab
 * and filters go along as the query. The `view` + filter query is a proposal beyond WBS 11.
 */
export function refreshIssues(teamId: string, view: IssueListView, filters: IssueFilters) {
  const query = view === 'all' ? issueFilterQuery(filters) : new URLSearchParams();
  query.set('view', view);
  return apiFetch<{ refreshedAt: string }>(`${base(teamId)}/issues/refresh?${query}`, {
    method: 'POST',
  });
}

/** "프로젝트에 추가": put an issue on the team's Projects board */
export function addIssueToProject(teamId: string, issueId: number) {
  return apiFetch<void>(`${base(teamId)}/issues/${issueId}/project-item`, { method: 'POST' });
}
