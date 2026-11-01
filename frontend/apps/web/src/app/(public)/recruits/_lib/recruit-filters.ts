import { createLoader, parseAsString, parseAsStringLiteral } from 'nuqs/server';

import {
  RECRUIT_FORMATS,
  RECRUIT_ROLES,
  type RecruitFormat,
  type RecruitRoleKey,
} from '@/features/recruit/recruit-labels';

/** 07 TODO 19 tabs: 전체 / 내 모집 글 / 내 지원 (the last two are developer-only, POL-A-9) */
export const RECRUIT_TABS = ['all', 'mine', 'applied'] as const;
export type RecruitTab = (typeof RECRUIT_TABS)[number];

/** POL-R-2: newest or closing soon */
export const RECRUIT_SORTS = ['NEWEST', 'DEADLINE'] as const;
export type RecruitSort = (typeof RECRUIT_SORTS)[number];

export const recruitTabParser = parseAsStringLiteral(RECRUIT_TABS).withDefault('all');

/**
 * Sort and filters kept in the URL (POL-R-2), read on the server with `loadRecruitParams` and on the
 * client with `useQueryStates(recruitFilterParsers)`. One value each, like the 09 WBS query.
 */
export const recruitFilterParsers = {
  sort: parseAsStringLiteral(RECRUIT_SORTS).withDefault('NEWEST'),
  role: parseAsStringLiteral(RECRUIT_ROLES),
  tech: parseAsString,
  mode: parseAsStringLiteral(RECRUIT_FORMATS),
};

export const loadRecruitParams = createLoader({ tab: recruitTabParser, ...recruitFilterParsers });

export type RecruitFilters = {
  sort: RecruitSort;
  role: RecruitRoleKey | null;
  tech: string | null;
  mode: RecruitFormat | null;
};

/** Query string for `GET /api/v1/public/recruits?role=&tech=&mode=&sort=` (09 WBS 19) */
export function recruitFilterQuery(filters: RecruitFilters): URLSearchParams {
  const query = new URLSearchParams({ sort: filters.sort });
  if (filters.role) query.set('role', filters.role);
  if (filters.tech) query.set('tech', filters.tech);
  if (filters.mode) query.set('mode', filters.mode);
  return query;
}

/** How many filters are set (sort excluded), for the filter button and the empty copy */
export function activeFilterCount(filters: RecruitFilters): number {
  return [filters.role, filters.tech, filters.mode].filter(Boolean).length;
}
