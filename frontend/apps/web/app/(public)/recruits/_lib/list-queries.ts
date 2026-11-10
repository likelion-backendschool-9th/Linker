import { infiniteQueryOptions } from '@tanstack/react-query';

import {
  RECRUIT_FORMAT_LABELS,
  RECRUIT_GOAL_LABELS,
  RECRUIT_ROLE_LABELS,
  type RecruitFormat,
  type RecruitGoal,
  type RecruitRoleKey,
} from '@/features/recruit/recruit-labels';

export type { RecruitFormat, RecruitRoleKey };
import { apiFetch } from '@/lib/api/api-fetch';
import { formatDeadlineDate, formatFullDate } from '@/lib/format/time';
import type { Route } from 'next';

import type { RecruitCardData } from '../_components/recruit-card';

/** Cancelled applications aren't listed (POL-R-3). */
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export type RecruitCard = {
  id: number;
  title: string;
  author: { id: number; login: string; name: string; avatarUrl: string };
  format: RecruitFormat;
  region: string | null;
  goal: RecruitGoal | null;
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

export type MyApplication = {
  id: number;
  status: ApplicationStatus;
  appliedAt: string;
  roleName: string;
  recruit: RecruitCard;
  teamChatRoomId: number | null;
};

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export const RECRUIT_LIST_TABS = ['all', 'mine', 'applied'] as const;
export type RecruitListTab = (typeof RECRUIT_LIST_TABS)[number];

export const RECRUIT_SORTS = ['NEWEST', 'DEADLINE'] as const;
export type RecruitSort = (typeof RECRUIT_SORTS)[number];

export const RECRUIT_SORT_LABELS: Record<RecruitSort, string> = {
  NEWEST: '최신순',
  DEADLINE: '마감순',
};

export type RecruitListFilters = {
  role: RecruitRoleKey | null;
  tech: string | null;
  mode: RecruitFormat | null;
  sort: RecruitSort;
};

export const recruitListKeys = {
  all: (login: string | null, filters: RecruitListFilters) =>
    ['recruits', 'list', login, filters] as const,
  mine: (login: string | null) => ['recruits', 'mine', login] as const,
  applied: (login: string | null) => ['recruits', 'applied', login] as const,
};

export function publicRecruitsOptions(login: string | null, filters: RecruitListFilters) {
  return infiniteQueryOptions({
    queryKey: recruitListKeys.all(login, filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams();
      if (filters.role) query.set('role', filters.role);
      if (filters.tech) query.set('tech', filters.tech);
      if (filters.mode) query.set('mode', filters.mode);
      if (filters.sort !== 'NEWEST') query.set('sort', filters.sort);
      if (pageParam) query.set('cursor', pageParam);
      const suffix = query.size ? `?${query}` : '';
      return apiFetch<CursorPage<RecruitCard>>(`/api/v1/public/recruits${suffix}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function myRecruitsOptions(login: string | null) {
  return infiniteQueryOptions({
    queryKey: recruitListKeys.mine(login),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<CursorPage<RecruitCard>>(`/api/v1/user/me/recruits${query}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function myApplicationsOptions(login: string | null) {
  return infiniteQueryOptions({
    queryKey: recruitListKeys.applied(login),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<CursorPage<MyApplication>>(`/api/v1/user/me/applications${query}`, {
        signal,
      });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function cancelMyApplication(applicationId: number) {
  return apiFetch<void>(`/api/v1/user/me/applications/${applicationId}`, { method: 'DELETE' });
}

/** Map API card → 19 list card view model (Figma 254:2255). */
export function toRecruitCardData(card: RecruitCard): RecruitCardData {
  const openRoles = card.roles.filter((role) => role.remaining > 0);
  const roleSource = openRoles.length > 0 ? openRoles : card.roles;
  return {
    id: String(card.id),
    href: `/recruits/${card.id}` as Route,
    format: RECRUIT_FORMAT_LABELS[card.format],
    goal: card.goal ? RECRUIT_GOAL_LABELS[card.goal] : '',
    deadlineLabel: formatDeadlineDate(card.deadline),
    deadlineFullLabel: `${formatFullDate(card.deadline)} 마감`,
    title: card.title,
    roles: card.roles.map((role) => `${role.name} ${role.remaining}명`),
    recruitingRoleLabel: roleSource
      .map((role) => `${RECRUIT_ROLE_LABELS[role.role] ?? role.name} ${role.remaining}명`)
      .join(', '),
    techStack: card.techTags,
  };
}
