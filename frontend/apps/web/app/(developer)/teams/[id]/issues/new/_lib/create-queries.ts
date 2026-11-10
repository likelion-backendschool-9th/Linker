import type {
  IssueCreateRequest,
  IssueCreateResponse,
  IssueDetailPerson,
  IssueTemplateResponse,
  ListResponse,
} from '@linker/api/openAPIDefinition.schemas';
import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';
import { ISSUE } from '@/lib/policy';

import type { AssigneeCandidates } from '../../../_lib/issue-detail-queries';
import type { IssueLabel, IssueUser } from '../../../_lib/issue-queries';

/** Repo row from `GET .../issue-filters` (no write flag — server enforces on create). */
export type CreateRepo = { id: number; name: string };

/** REPO / ORG / DEFAULT — `Choice` from template list. */
export type TemplateSummary = {
  key: string;
  source: string;
  name: string;
  description: string;
  format?: string;
};

/** One issue-form field after mapping OpenAPI `Field` for the screen. */
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
  | { id: string; type: string; label?: string };

type TemplateBase = TemplateSummary & {
  defaultTitle?: string;
  defaultLabels: string[];
  defaultAssignees: string[];
  fallback: boolean;
};

export type ParsedTemplate =
  | (TemplateBase & { kind: 'MARKDOWN'; body: string })
  | (TemplateBase & { kind: 'FORM'; fields: FormField[] });

export type CreateIssueBody = IssueCreateRequest;

export type CreateProgress = IssueCreateResponse;

const team = (teamId: string) => `/api/v1/user/teams/${encodeURIComponent(teamId)}`;

function personToUser(person: IssueDetailPerson & { jobRole?: string }): IssueUser {
  return {
    id: person.id ?? 0,
    login: person.login,
    name: person.name,
    avatarUrl: person.avatarUrl ?? '',
    ...(person.jobRole ? { jobRole: person.jobRole } : {}),
  };
}

function mapField(field: NonNullable<IssueTemplateResponse['fields']>[number]): FormField {
  const id = field.id ?? '';
  const type = field.type ?? '';
  if (type === 'markdown') {
    return { id, type: 'markdown', value: field.value ?? '' };
  }
  if (type === 'upload') {
    return { id, type: 'upload', label: field.label ?? '' };
  }
  if (type === 'checkboxes') {
    const requiredOptions = new Set(field.requiredOptions ?? []);
    return {
      id,
      type: 'checkboxes',
      label: field.label ?? '',
      description: field.description,
      options: (field.options ?? []).map((label, index) => ({
        label,
        required: requiredOptions.has(index),
      })),
    };
  }
  if (type === 'dropdown') {
    return {
      id,
      type: 'dropdown',
      label: field.label ?? '',
      description: field.description,
      options: field.options ?? [],
      multiple: field.multiple,
      required: field.required,
    };
  }
  if (type === 'input' || type === 'textarea') {
    return {
      id,
      type,
      label: field.label ?? '',
      description: field.description,
      placeholder: field.placeholder,
      required: field.required,
    };
  }
  return { id, type, label: field.label };
}

function mapTemplate(raw: IssueTemplateResponse): ParsedTemplate {
  const base = {
    key: raw.key ?? '',
    source: raw.source ?? 'DEFAULT',
    name: raw.name ?? '',
    description: raw.description ?? '',
    format: raw.format,
    defaultTitle: raw.title ?? '',
    defaultLabels: raw.labels ?? [],
    defaultAssignees: raw.assignees ?? [],
    fallback: Boolean(raw.fallback),
  };
  if (raw.format === 'FORM') {
    return { ...base, kind: 'FORM', fields: (raw.fields ?? []).map(mapField) };
  }
  return { ...base, kind: 'MARKDOWN', body: raw.body ?? '' };
}

async function fetchTemplateList(
  teamId: string,
  repoId: number,
  signal?: AbortSignal,
): Promise<ListResponse> {
  return apiFetch<ListResponse>(`${team(teamId)}/issue-templates?repoId=${repoId}`, { signal });
}

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
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ repos: CreateRepo[] }>(`${team(teamId)}/issue-filters`, {
        signal,
      });
      return { items: data.repos ?? [] };
    },
  });
}

export function templatesOptions(teamId: string, repoId: number) {
  return queryOptions({
    queryKey: createKeys.templates(teamId, repoId),
    queryFn: async ({ signal }): Promise<{ items: TemplateSummary[] }> => {
      const data = await fetchTemplateList(teamId, repoId, signal);
      return {
        items: (data.templates ?? []).map((item) => ({
          key: item.key ?? '',
          name: item.name ?? '',
          description: item.description ?? '',
          source: item.source ?? 'DEFAULT',
          format: item.format,
        })),
      };
    },
  });
}

export function templateOptions(teamId: string, repoId: number, key: string) {
  return queryOptions({
    queryKey: createKeys.template(teamId, repoId, key),
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const raw = await apiFetch<IssueTemplateResponse>(
        `${team(teamId)}/issue-templates/${encodeURIComponent(key)}?repoId=${repoId}`,
        { signal },
      );
      return mapTemplate(raw);
    },
  });
}

/** Assignees/labels/max from `GET .../issue-templates?repoId=` (same payload as the template list). */
export function createAssigneeOptions(teamId: string, repoId: number) {
  return queryOptions({
    queryKey: createKeys.assignees(teamId, repoId),
    queryFn: async ({ signal }): Promise<AssigneeCandidates> => {
      const data = await fetchTemplateList(teamId, repoId, signal);
      return {
        items: (data.assigneeCandidates ?? []).map(personToUser),
        max: data.maxAssignees ?? ISSUE.assigneesMax,
      };
    },
  });
}

export function createLabelOptions(teamId: string, repoId: number) {
  return queryOptions({
    queryKey: createKeys.labels(teamId, repoId),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<{ items: IssueLabel[] }> => {
      const data = await fetchTemplateList(teamId, repoId, signal);
      return {
        items: (data.labelOptions ?? []).map((label) => ({
          name: label.name ?? '',
          color: label.color ?? '',
        })),
      };
    },
  });
}

export function createIssue(teamId: string, request: CreateIssueBody) {
  return apiFetch<CreateProgress>(`${team(teamId)}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function getSyncJob(teamId: string, jobId: number) {
  return apiFetch<CreateProgress>(`${team(teamId)}/issue-sync-jobs/${jobId}`);
}
