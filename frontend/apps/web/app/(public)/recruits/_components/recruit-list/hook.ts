'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from 'nuqs';
import { useEffect, useRef } from 'react';

import { useRequireLogin } from '@/features/auth/use-require-login';
import {
  RECRUIT_FORMAT_LABELS,
  RECRUIT_FORMATS,
  RECRUIT_ROLE_LABELS,
  RECRUIT_ROLES,
  type RecruitFormat,
  type RecruitRoleKey,
} from '@/features/recruit/recruit-labels';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import {
  cancelMyApplication,
  myApplicationsOptions,
  myRecruitsOptions,
  publicRecruitsOptions,
  RECRUIT_LIST_TABS,
  RECRUIT_SORT_LABELS,
  RECRUIT_SORTS,
  recruitListKeys,
  toRecruitCardData,
  type MyApplication,
  type RecruitListTab,
  type RecruitSort,
} from '../../_lib/list-queries';
import { DEFAULT_FILTER_STATE, type FilterField, type FilterState } from '../recruit-filter-sheet';

const tabParser = parseAsStringLiteral(RECRUIT_LIST_TABS)
  .withDefault('all')
  .withOptions({ history: 'replace' });

const roleParser = parseAsStringLiteral(RECRUIT_ROLES).withOptions({ history: 'replace' });
const formatParser = parseAsStringLiteral(RECRUIT_FORMATS).withOptions({ history: 'replace' });
const sortParser = parseAsStringLiteral(RECRUIT_SORTS)
  .withDefault('NEWEST')
  .withOptions({ history: 'replace' });
const techParser = parseAsString.withOptions({ history: 'replace' });

function sheetLabel(field: FilterField, value: string | null): string | null {
  if (!value) return null;
  if (field === 'sort') return RECRUIT_SORT_LABELS[value as RecruitSort] ?? value;
  if (field === 'format') return RECRUIT_FORMAT_LABELS[value as RecruitFormat] ?? value;
  if (field === 'role') return RECRUIT_ROLE_LABELS[value as RecruitRoleKey] ?? value;
  return value;
}

export function useRecruitList() {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const filterOverlay = useOverlay('recruit-filter');
  const [tab, setTab] = useQueryState('tab', tabParser);
  const [filters, setFilters] = useQueryStates({
    role: roleParser,
    tech: techParser,
    mode: formatParser,
    sort: sortParser,
  });

  const loginNeeded = (tab === 'mine' || tab === 'applied') && viewer.role === 'guest';
  const listFilters = {
    role: filters.role,
    tech: filters.tech,
    mode: filters.mode,
    sort: (filters.sort ?? 'NEWEST') as RecruitSort,
  };

  const publicList = useInfiniteQuery({
    ...publicRecruitsOptions(viewer.login, listFilters),
    enabled: tab === 'all',
  });
  const mineList = useInfiniteQuery({
    ...myRecruitsOptions(viewer.login),
    enabled: tab === 'mine' && !loginNeeded,
  });
  const appliedList = useInfiniteQuery({
    ...myApplicationsOptions(viewer.login),
    enabled: tab === 'applied' && !loginNeeded,
  });

  const active = tab === 'mine' ? mineList : tab === 'applied' ? appliedList : publicList;

  const recruits =
    tab === 'all'
      ? (publicList.data?.pages.flatMap((page) => page.items) ?? []).map(toRecruitCardData)
      : tab === 'mine'
        ? (mineList.data?.pages.flatMap((page) => page.items) ?? []).map(toRecruitCardData)
        : [];

  const applications: MyApplication[] =
    tab === 'applied' ? (appliedList.data?.pages.flatMap((page) => page.items) ?? []) : [];

  const selectedFilters: FilterState = {
    role: filters.role,
    tech: filters.tech,
    format: filters.mode,
    sort: listFilters.sort,
  };

  const chipFilters: FilterState = {
    role: sheetLabel('role', filters.role),
    tech: filters.tech,
    format: sheetLabel('format', filters.mode),
    sort: sheetLabel('sort', listFilters.sort) ?? DEFAULT_FILTER_STATE.sort,
  };

  function handleSelect(field: FilterField, value: string) {
    if (field === 'role') void setFilters({ role: value as RecruitRoleKey });
    else if (field === 'tech') void setFilters({ tech: value });
    else if (field === 'format') void setFilters({ mode: value as RecruitFormat });
    else if (field === 'sort') void setFilters({ sort: value as RecruitSort });
  }

  function selectTab(next: RecruitListTab) {
    if ((next === 'mine' || next === 'applied') && viewer.role === 'guest') {
      void requireLogin(`/recruits?tab=${next}`);
      return;
    }
    void setTab(next);
  }

  return {
    tab,
    selectTab,
    loginNeeded,
    promptLogin: () => void requireLogin(`/recruits?tab=${tab}`),
    filterOverlay,
    selectedFilters,
    chipFilters,
    handleSelect,
    recruits,
    applications,
    count: tab === 'applied' ? applications.length : recruits.length,
    sortLabel: RECRUIT_SORT_LABELS[listFilters.sort],
    query: active,
    promptWrite: () => void requireLogin('/recruits/new'),
    isGuest: viewer.role === 'guest',
  };
}

export function useCancelApplication() {
  const client = useQueryClient();
  const viewer = useViewer();
  return useMutation({
    mutationFn: (applicationId: number) => cancelMyApplication(applicationId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: recruitListKeys.applied(viewer.login) });
    },
  });
}

/** Infinite-scroll sentinel: load the next page when it enters the viewport. */
export function useLoadMoreSentinel(enabled: boolean, loading: boolean, onLoadMore: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loading) onLoadMore();
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, loading, onLoadMore]);
  return ref;
}
