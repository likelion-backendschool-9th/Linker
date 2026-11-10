import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

import type { AssigneeCandidates } from '../../../_lib/issue-detail-queries';
import type { IssueLabel } from '../../../_lib/issue-queries';
import type { IssueStatus } from '../../../../../_lib/issue-status';

/**
 * Provisional 13 `IssueController` contract (WBS 13). Hand-written until it's in OpenAPI.
 * `issue-create/repos` and the two `repos/{repoId}/…` options are a proposal beyond WBS: 12's options
 * need an issue id that doesn't exist yet, and GitHub takes assignees and labels per repo (POL-I-2).
 */

export type CreateRepo = { id: number; name: string; fullName: string; canWrite: boolean };

/** REPO = the repo's .github/ISSUE_TEMPLATE, ORG = the org's public .github repo, DEFAULT = 버그/기능/작업 */
export type TemplateSummary = {
  key: string;
  source: 'REPO' | 'ORG' | 'DEFAULT';
  name: string;
  description: string;
};

/** One issue form (YAML) item. `markdown` is help text; `upload` is phase 2 (POL-I-1). */
export type FormField =
  | { id: string; type: 'markdown'; value: string }
  | {
      id: string;
      type: 'input' | 'textarea';
      label: string;
      description?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      type: 'dropdown';
      label: string;
      description?: string;
      options: string[];
      multiple?: boolean;
      required?: boolean;
    }
  | {
      id: string;
      type: 'checkboxes';
      label: string;
      description?: string;
      options: { label: string; required?: boolean }[];
    }
  | { id: string; type: 'upload'; label: string }
  /** Anything else GitHub may add: only its label goes into the body (04 ch. 7 exceptions) */
  | { id: string; type: string; label?: string };

type TemplateBase = TemplateSummary & {
  defaultTitle?: string;
  /** Applied by Linker as starting values (POL-I-1) */
  defaultLabels: string[];
  /** GitHub logins */
  defaultAssignees: string[];
  /** The repo template couldn't be parsed, so this is the default template instead */
  fallback: boolean;
};

export type ParsedTemplate =
  | (TemplateBase & { kind: 'MARKDOWN'; body: string })
  | (TemplateBase & { kind: 'FORM'; fields: FormField[] });

export type CreateIssueRequest = {
  repoId: number;
  templateKey: string;
  title: string;
  body: string;
  assigneeIds: number[];
  labels: string[];
  startDate: string | null;
  dueDate: string | null;
  status: IssueStatus;
};

export type SyncJob = {
  status: 'RUNNING' | 'DONE' | 'FAILED';
  steps: { name: string; done: boolean }[];
  issueId: number;
  failedStep: string | null;
};

const team = (teamId: string) => `/api/v1/user/teams/${encodeURIComponent(teamId)}`;

export const createKeys = {
  repos: (teamId: string) => ['issues', teamId, 'create', 'repos'] as const,
  templates: (teamId: string, repoId: number) =>
    ['issues', teamId, 'create', 'templates', repoId] as const,
  template: (teamId: string, repoId: number, key: string) =>
    ['issues', teamId, 'create', 'template', repoId, key] as const,
  assignees: (teamId: string, repoId: number) =>
    ['issues', teamId, 'create', 'assignees', repoId] as const,
  labels: (teamId: string, repoId: number) =>
    ['issues', teamId, 'create', 'labels', repoId] as const,
};

export function createReposOptions(teamId: string) {
  return queryOptions({
    queryKey: createKeys.repos(teamId),
    queryFn: ({ signal }) =>
      apiFetch<{ items: CreateRepo[] }>(`${team(teamId)}/issue-create/repos`, { signal }),
  });
}

export function templatesOptions(teamId: string, repoId: number) {
  return queryOptions({
    queryKey: createKeys.templates(teamId, repoId),
    queryFn: ({ signal }) =>
      apiFetch<{ items: TemplateSummary[] }>(`${team(teamId)}/issue-templates?repoId=${repoId}`, {
        signal,
      }),
  });
}

export function templateOptions(teamId: string, repoId: number, key: string) {
  return queryOptions({
    queryKey: createKeys.template(teamId, repoId, key),
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      apiFetch<ParsedTemplate>(
        `${team(teamId)}/issue-templates/${encodeURIComponent(key)}?repoId=${repoId}`,
        { signal },
      ),
  });
}

export function createAssigneeOptions(teamId: string, repoId: number) {
  return queryOptions({
    queryKey: createKeys.assignees(teamId, repoId),
    queryFn: ({ signal }) =>
      apiFetch<AssigneeCandidates>(`${team(teamId)}/repos/${repoId}/assignee-candidates`, {
        signal,
      }),
  });
}

export function createLabelOptions(teamId: string, repoId: number) {
  return queryOptions({
    queryKey: createKeys.labels(teamId, repoId),
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      apiFetch<{ items: IssueLabel[] }>(`${team(teamId)}/repos/${repoId}/label-options`, {
        signal,
      }),
  });
}

/** 202 + jobId: the server then adds it to the project and sets dates and status (POL-I sync) */
export function createIssue(teamId: string, request: CreateIssueRequest) {
  return apiFetch<{ jobId: string; issueId: number }>(`${team(teamId)}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function getSyncJob(teamId: string, jobId: string) {
  return apiFetch<SyncJob>(`${team(teamId)}/issue-sync-jobs/${encodeURIComponent(jobId)}`);
}
