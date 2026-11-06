'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useQueryState, useQueryStates } from 'nuqs';

import { useRequireLogin } from '@/features/auth/use-require-login';
import { RECRUIT_FORMAT_LABELS, RECRUIT_ROLE_LABELS } from '@/features/recruit/recruit-labels';
import { useInfiniteScrollTrigger } from '@/hooks/use-infinite-scroll-trigger';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  activeFilterCount,
  recruitFilterParsers,
  recruitTabParser,
  type RecruitFilters,
  type RecruitTab,
} from '../../_lib/recruit-filters';
import {
  cancelApplication,
  myApplicationsOptions,
  myRecruitsOptions,
  recruitKeys,
  recruitListOptions,
  type Page,
} from '../../_lib/recruit-list-queries';

export const RECRUIT_TAB_LABELS: Record<RecruitTab, string> = {
  all: '전체',
  mine: '내 모집 글',
  applied: '내 지원',
};

export function useRecruitList() {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  const recruiter = viewer.role === 'recruiter';
  const [selected, setTab] = useQueryState('tab', recruitTabParser);
  const tab = viewer.role === 'developer' || viewer.role === 'operator' ? selected : 'all';

  return {
    viewer,
    recruiter,
    tab,
    selectTab: (item: RecruitTab) => {
      if (item !== 'all' && !requireLogin(`/recruits?tab=${item}`)) return;
      void setTab(item);
    },
  };
}

export function useWriteRecruitButton() {
  const viewer = useViewer();
  const requireLogin = useRequireLogin();
  return {
    isGuest: viewer.role === 'guest',
    promptLogin: () => requireLogin('/recruits/new'),
  };
}

export function useAllRecruits() {
  const viewer = useViewer();
  const [filters, setFilters] = useQueryStates(recruitFilterParsers, { history: 'replace' });
  const recruits = useInfiniteQuery(recruitListOptions(viewer.login, filters));
  const filterSheet = useOverlay('recruit-filter');
  const count = activeFilterCount(filters);

  return {
    filters,
    setFilters,
    recruits,
    filterCount: count,
    openFilters: () => filterSheet.open(),
  };
}

type FilterPatch = Partial<Pick<RecruitFilters, 'role' | 'tech' | 'mode'>>;

export function useActiveFilterChips(filters: RecruitFilters) {
  const applied: { key: string; label: string; patch: FilterPatch }[] = [];
  if (filters.role)
    applied.push({ key: 'role', label: RECRUIT_ROLE_LABELS[filters.role], patch: { role: null } });
  if (filters.mode)
    applied.push({
      key: 'mode',
      label: RECRUIT_FORMAT_LABELS[filters.mode],
      patch: { mode: null },
    });
  if (filters.tech) applied.push({ key: 'tech', label: filters.tech, patch: { tech: null } });
  return applied;
}

export function useMyRecruits() {
  const viewer = useViewer();
  return useInfiniteQuery(myRecruitsOptions(viewer.login));
}

export function useMyApplications() {
  const viewer = useViewer();
  const client = useQueryClient();
  const applications = useInfiniteQuery(myApplicationsOptions(viewer.login));
  const confirm = useOverlay('application-cancel');
  const cancel = useMutation({
    mutationFn: cancelApplication,
    onSuccess: async () => {
      confirm.close();
      toast('지원을 취소했어요.');
      await client.invalidateQueries({ queryKey: recruitKeys.all });
    },
  });
  const items = applications.data?.pages.flatMap((page) => page.items) ?? [];
  const suspended = viewer.status === 'SUSPENDED';

  return {
    applications,
    cancel,
    confirm,
    items,
    suspended,
    cancelPending: cancel.isPending,
    openCancel: (id: number) => confirm.open(String(id)),
    confirmCancel: () => {
      const id = Number(confirm.id);
      if (items.some((item) => item.id === id && item.status === 'PENDING') && !suspended)
        cancel.mutate(id);
    },
  };
}

export function usePagedList<T extends { id: number }>(
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>>,
) {
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const sentinel = useInfiniteScrollTrigger<HTMLDivElement>({
    enabled: hasNextPage && !isFetchingNextPage && !query.isError,
    onTrigger: () => void fetchNextPage(),
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return {
    items,
    sentinel,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => void fetchNextPage(),
  };
}
