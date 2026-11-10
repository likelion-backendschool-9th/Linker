'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from 'nuqs';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

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
  parseRecruitSearch,
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
const searchParser = parseAsString.withOptions({ history: 'replace' });

const SEARCH_DELAY_MS = 300;

/** What the search box shows and edits; the list follows `?q=` (POL-R-2, title only). */
export type RecruitSearchControl = {
  draft: string;
  setDraft: (value: string) => void;
  submit: (event: FormEvent) => void;
  clear: () => void;
};

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

  // Search box: typed locally, written to `?q=` after a short pause or on Enter (same as 11)
  const [rawQ, setQ] = useQueryState('q', searchParser);
  const q = parseRecruitSearch(rawQ);
  const [draft, setDraft] = useState(q ?? '');
  const applySearch = useCallback((next: string | null) => void setQ(next), [setQ]);
  useEffect(() => {
    const next = parseRecruitSearch(draft);
    if (next === q) return;
    const timer = window.setTimeout(() => applySearch(next), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, q, applySearch]);
  const search: RecruitSearchControl = {
    draft,
    setDraft,
    submit: (event) => {
      event.preventDefault();
      applySearch(parseRecruitSearch(draft));
    },
    clear: () => {
      setDraft('');
      applySearch(null);
    },
  };

  const loginNeeded = (tab === 'mine' || tab === 'applied') && viewer.role === 'guest';
  const listFilters = {
    q,
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

  /** Picking the selected role/tech/format again clears it ("필터를 줄여 보세요"); sort always has one. */
  function handleSelect(field: FilterField, value: string) {
    const next = selectedFilters[field] === value ? null : value;
    if (field === 'role') void setFilters({ role: next as RecruitRoleKey | null });
    else if (field === 'tech') void setFilters({ tech: next });
    else if (field === 'format') void setFilters({ mode: next as RecruitFormat | null });
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
    search,
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
