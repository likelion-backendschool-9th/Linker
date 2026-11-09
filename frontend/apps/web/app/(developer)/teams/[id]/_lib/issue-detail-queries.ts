import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import type { IssueAssignee, IssueLabel, IssueUser } from './issue-queries';
import type { BoardStatusColor, IssueStatus } from '../../../_lib/issue-status';

/**
 * Provisional 12 `IssueController` contract (WBS 12). Hand-written until the controller is in
 * OpenAPI; then replace with the orval `p12-issue-detail` hooks. 13, 14 and 15 borrow these.
 */

export type IssueDetail = {
  id: number;
  teamId: number;
  number: number;
  repoId: number;
  repoName: string;
  title: string;
  /** Sanitized Markdown from the server; rendered again through rehype-sanitize */
  body: string;
  status: IssueStatus;
  statusColor: BoardStatusColor;
  state: 'OPEN' | 'CLOSED';
  assignees: IssueAssignee[];
  labels: IssueLabel[];
  /** `yyyy-MM-dd` in KST */
  startDate: string | null;
  dueDate: string | null;
  overdue: boolean;
  inProject: boolean;
  author: IssueUser;
  githubUrl: string;
  createdAt: string;
  updatedAt: string;
  /** Sub-issues made on GitHub, view-only in MVP (04 ch. 7 exceptions) */
  subIssues: { total: number; done: number };
  /** Repo write permission (POL-I-2) */
  canWrite: boolean;
  /** `sync_status = FAILED`: a date or status didn't reach GitHub */
  syncFailed: boolean;
  deletedOrMoved: null | 'DELETED' | 'MOVED';
  /** Where a transferred issue lives now */
  movedToIssueId: number | null;
};

/** `GET .../sub-issues` (view-only): number, title and open/closed; `id` is null for repos Linker doesn't link */
export type SubIssues = {
  items: { id?: number | null; number: number; title: string; state: 'OPEN' | 'CLOSED' }[];
  total: number;
  done: number;
};

export type AssigneeCandidates = { items: IssueUser[]; max: number };

export const issueDetailKeys = {
  detail: (teamId: string, issueId: string) => ['issues', teamId, 'detail', issueId] as const,
  assigneeCandidates: (teamId: string, issueId: string) =>
    ['issues', teamId, 'detail', issueId, 'assignee-candidates'] as const,
  labelOptions: (teamId: string, issueId: string) =>
    ['issues', teamId, 'detail', issueId, 'label-options'] as const,
};

const base = (teamId: string, issueId: string) =>
  `/api/v1/user/teams/${encodeURIComponent(teamId)}/issues/${encodeURIComponent(issueId)}`;

const json = (method: 'PUT', body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function issueDetailOptions(teamId: string, issueId: string) {
  return queryOptions({
    queryKey: issueDetailKeys.detail(teamId, issueId),
    queryFn: ({ signal }) => apiFetch<IssueDetail>(base(teamId, issueId), { signal }),
  });
}

export function subIssuesOptions(teamId: string, issueId: string) {
  return queryOptions({
    queryKey: [...issueDetailKeys.detail(teamId, issueId), 'sub-issues'] as const,
    queryFn: ({ signal }) => apiFetch<SubIssues>(`${base(teamId, issueId)}/sub-issues`, { signal }),
  });
}

/** Members with access to the repo who accepted the GitHub org invite (POL-I-2) */
export function assigneeCandidatesOptions(teamId: string, issueId: string) {
  return queryOptions({
    queryKey: issueDetailKeys.assigneeCandidates(teamId, issueId),
    queryFn: ({ signal }) =>
      apiFetch<AssigneeCandidates>(`${base(teamId, issueId)}/assignee-candidates`, { signal }),
  });
}

export function labelOptionsOptions(teamId: string, issueId: string) {
  return queryOptions({
    queryKey: issueDetailKeys.labelOptions(teamId, issueId),
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      apiFetch<{ items: IssueLabel[] }>(`${base(teamId, issueId)}/label-options`, { signal }),
  });
}

export function saveAssignees(teamId: string, issueId: string, userIds: number[]) {
  return apiFetch<{ assignees: IssueAssignee[] }>(
    `${base(teamId, issueId)}/assignees`,
    json('PUT', { userIds }),
  );
}

export function saveLabels(teamId: string, issueId: string, labels: string[]) {
  return apiFetch<{ labels: IssueLabel[] }>(
    `${base(teamId, issueId)}/labels`,
    json('PUT', { labels }),
  );
}

export type IssueSchedule = { startDate: string | null; dueDate: string | null };

export function saveSchedule(teamId: string, issueId: string, schedule: IssueSchedule) {
  return apiFetch<IssueSchedule>(`${base(teamId, issueId)}/schedule`, json('PUT', schedule));
}

/** Done closes the issue, moving back reopens it (POL-I-3). The board (14) borrows this. */
export function saveStatus(teamId: string, issueId: string, status: IssueStatus) {
  return apiFetch<{ status: IssueStatus; statusColor: BoardStatusColor; state: 'OPEN' | 'CLOSED' }>(
    `${base(teamId, issueId)}/status`,
    json('PUT', { status }),
  );
}
