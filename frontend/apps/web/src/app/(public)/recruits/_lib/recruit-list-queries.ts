import { infiniteQueryOptions } from '@tanstack/react-query';

import type { RecruitFormat, RecruitGoal, RecruitRoleKey } from '@/features/recruit/recruit-labels';
import { apiFetch } from '@/lib/api/api-fetch';

import { recruitFilterQuery, type RecruitFilters } from './recruit-filters';

/** Provisional WBS 19 `RecruitListController` contract; replace with Orval types when OpenAPI is available. */
export type RecruitSummary = {
  id: number;
  title: string;
  author: { id: number; login: string; name: string; avatarUrl: string };
  format: RecruitFormat;
  region: string | null;
  goal: RecruitGoal | null;
  /** `yyyy-MM-dd` in KST */
  deadline: string;
  status: 'OPEN' | 'CLOSED';
  techTags: string[];
  roles: {
    id: number;
    role: RecruitRoleKey;
    name: string;
    headcount: number;
    filled: number;
    remaining: number;
  }[];
  createdAt: string;
};

/** Cancelled applications aren't listed (04 ch. 5 "Application status") */
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export type MyApplication = {
  id: number;
  status: ApplicationStatus;
  appliedAt: string;
  roleName: string;
  recruit: RecruitSummary;
  /** Accepted only: shortcut to the team chat (POL-R-4) */
  teamChatRoomId: number | null;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export const recruitKeys = {
  all: ['recruits'] as const,
  /** Per account, so logging in or out never shows another viewer's tabs */
  account: (login: string | null) => ['recruits', login] as const,
};

function cursorQuery(query: URLSearchParams, cursor: string | null) {
  if (cursor) query.set('cursor', cursor);
  return query.size ? `?${query}` : '';
}

/** 전체 tab: open posts, block relations excluded by the server when logged in */
export function recruitListOptions(login: string | null, filters: RecruitFilters) {
  return infiniteQueryOptions({
    queryKey: [...recruitKeys.account(login), 'list', filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiFetch<Page<RecruitSummary>>(
        `/api/v1/public/recruits${cursorQuery(recruitFilterQuery(filters), pageParam)}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** 내 모집 글 tab: my posts, open and closed */
export function myRecruitsOptions(login: string | null) {
  return infiniteQueryOptions({
    queryKey: [...recruitKeys.account(login), 'mine'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiFetch<Page<RecruitSummary>>(
        `/api/v1/user/me/recruits${cursorQuery(new URLSearchParams(), pageParam)}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** 내 지원 tab: every status except cancelled */
export function myApplicationsOptions(login: string | null) {
  return infiniteQueryOptions({
    queryKey: [...recruitKeys.account(login), 'applications'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiFetch<Page<MyApplication>>(
        `/api/v1/user/me/applications${cursorQuery(new URLSearchParams(), pageParam)}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Only while pending (POL-R-3); also borrowed by 21 */
export function cancelApplication(applicationId: number) {
  return apiFetch<void>(`/api/v1/user/me/applications/${applicationId}`, { method: 'DELETE' });
}
