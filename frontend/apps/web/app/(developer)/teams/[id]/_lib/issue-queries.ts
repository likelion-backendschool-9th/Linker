import {
  addTeamIssueToProject,
  getTeamIssueProgress,
  listTeamIssues,
  listUnscheduledTeamIssues,
  refreshTeamIssues,
} from '@linker/api/p11-issue-list/p11-issue-list';
import type { ListTeamIssuesParams } from '@linker/api/openAPIDefinition.schemas';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';
import { ISSUE } from '@/lib/policy';

import { issueFilterParams, type IssueFilters } from './issue-filters';
import type { BoardStatusColor, IssueStatus } from '../../../_lib/issue-status';

/**
 * 11 IssueController (`p11-issue-list`). List, counts, progress, refresh and "프로젝트에 추가" call the
 * generated orval functions. The row types below stay for 12–15, which still read them.
 */

export type IssueUser = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  /** Figma job label (PO/Fullstack…). Optional — real API has no field; mock may send it. */
  jobRole?: string;
};
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
  /** From board_status_mappings; OTHER/NONE → GRAY */
  statusColor: BoardStatusColor;
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

/** Everything sits under `['issues', teamId]` so 11–15 invalidate it together (07 too). */
export const issueKeys = {
  team: (teamId: string) => ['issues', teamId] as const,
  list: (teamId: string, view: IssueListView, filters: IssueFilters, q: string | null) =>
    ['issues', teamId, 'list', view, filters, q] as const,
  count: (teamId: string, params: ListTeamIssuesParams) =>
    ['issues', teamId, 'count', params] as const,
  progress: (teamId: string) => ['issues', teamId, 'progress'] as const,
  filterOptions: (teamId: string) => ['issues', teamId, 'filter-options'] as const,
};

const base = (teamId: string) => `/api/v1/user/teams/${encodeURIComponent(teamId)}`;

/**
 * All issues (filters + title search `q`) or the "일정 없음" list (`?view=unscheduled`, opened from 15's
 * calendar link): not on the board or no due date (POL-I-3). The unscheduled endpoint takes no filters.
 */
export function issueListOptions(
  teamId: string,
  view: IssueListView,
  filters: IssueFilters,
  q: string | null,
) {
  return infiniteQueryOptions({
    queryKey: issueKeys.list(teamId, view, filters, q),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const cursor = pageParam ?? undefined;
      return view === 'all'
        ? listTeamIssues(
            Number(teamId),
            { ...issueFilterParams(filters), q: q ?? undefined, cursor },
            { signal },
          )
        : listUnscheduledTeamIssues(Number(teamId), { cursor }, { signal });
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** How many issues match: one row is enough, `total` is the count (status chips and cards of 11). */
export function issueCountOptions(teamId: string, params: ListTeamIssuesParams) {
  return queryOptions({
    queryKey: issueKeys.count(teamId, params),
    queryFn: ({ signal }) => listTeamIssues(Number(teamId), { ...params, size: 1 }, { signal }),
    select: (page) => page.total,
  });
}

/** `[Included]` Progress of a Flex team (POL-T-7): the 14-day trend of 11. Free teams get PLAN_LIMIT. */
export function issueProgressOptions(teamId: string) {
  return queryOptions({
    queryKey: issueKeys.progress(teamId),
    queryFn: ({ signal }) =>
      getTeamIssueProgress(Number(teamId), { days: ISSUE.progressDays }, { signal }),
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
 * and filters go along as the query.
 */
export function refreshIssues(teamId: string, view: IssueListView, filters: IssueFilters) {
  return refreshTeamIssues(Number(teamId), {
    ...(view === 'all' ? issueFilterParams(filters) : {}),
    view,
  });
}

/** "프로젝트에 추가": put an issue on the team's Projects board */
export function addIssueToProject(teamId: string, issueId: number) {
  return addTeamIssueToProject(Number(teamId), issueId);
}
