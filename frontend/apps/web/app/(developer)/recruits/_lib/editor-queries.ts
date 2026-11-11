import { queryOptions } from '@tanstack/react-query';

import type { RecruitFormat, RecruitGoal, RecruitRoleKey } from '@/features/recruit/recruit-labels';
import { apiFetch } from '@/lib/api/api-fetch';

/** Provisional WBS 20 `RecruitmentController` contract; replace with Orval types when OpenAPI is available. */
export type EditorOptions = {
  /** Teams I can link: owner / admin (POL-R-1). `flex`: no free-team headcount cap */
  teams: { id: number; name: string; flex: boolean }[];
  /** Open posts now and the plan's cap (3, Pro 10) */
  openCount: number;
  openLimit: number;
  /** Today + 60 days in KST, `yyyy-MM-dd` */
  maxDeadlineDate: string;
};

export type RecruitRequest = {
  title: string;
  intro: string;
  roles: { id?: number; role: RecruitRoleKey; headcount: number }[];
  format: RecruitFormat;
  region: string | null;
  goal: RecruitGoal | null;
  duration: string | null;
  deadline: string;
  techTags: string[];
  /** Required (POL-R-1): a team I own or admin */
  teamId: number;
};

export type RecruitEditForm = Omit<RecruitRequest, 'roles' | 'teamId'> & {
  id: number;
  /** null only on posts saved before a team became required; editing them asks for one */
  teamId: number | null;
  status: 'OPEN' | 'CLOSED';
  roles: { id: number; role: RecruitRoleKey; name: string; headcount: number; filled: number }[];
  /** Roles with applicants can't be removed (04 ch. 5 exceptions) */
  lockedRoleIds: number[];
  /** Accepted count per role id; headcount can't go below it */
  minHeadcountByRole: Record<string, number>;
};

export const editorKeys = {
  // Under ['recruits'] so a write that invalidates the lists (19) refreshes these too
  options: (login: string | null) => ['recruits', login, 'editor', 'options'] as const,
  form: (login: string | null, recruitId: string) =>
    ['recruits', login, 'editor', 'form', recruitId] as const,
};

export function editorOptions(login: string | null) {
  return queryOptions({
    queryKey: editorKeys.options(login),
    queryFn: ({ signal }) =>
      apiFetch<EditorOptions>('/api/v1/user/recruit-editor/options', { signal }),
  });
}

export function editFormOptions(login: string | null, recruitId: string) {
  return queryOptions({
    queryKey: editorKeys.form(login, recruitId),
    queryFn: ({ signal }) =>
      apiFetch<RecruitEditForm>(
        `/api/v1/user/recruits/${encodeURIComponent(recruitId)}/edit-form`,
        { signal },
      ),
  });
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** 5/day, open cap 3 (Pro 10) → 403 PLAN_LIMIT opens the shared limit sheet */
export function createRecruit(request: RecruitRequest) {
  return apiFetch<{ id: number }>('/api/v1/user/recruits', { method: 'POST', ...json(request) });
}

export function updateRecruit(recruitId: string, request: RecruitRequest) {
  return apiFetch<{ id: number }>(`/api/v1/user/recruits/${encodeURIComponent(recruitId)}`, {
    method: 'PUT',
    ...json(request),
  });
}
