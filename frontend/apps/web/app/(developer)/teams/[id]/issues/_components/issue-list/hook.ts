'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { useQueryState, useQueryStates } from 'nuqs';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { ISSUE } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import {
  activeFilterCount,
  issueFilterParams,
  issueFilterParsers,
} from '../../../_lib/issue-filters';
import { PULL_MAX, usePullToRefresh } from '../../_hooks/use-pull-to-refresh';
import { ISSUE_SEARCH_MAX_LENGTH, issueSearchParser, issueViewParser } from '../../_lib/issue-view';
import { ISSUE_STATUS_LABELS } from '../../../../../_lib/issue-status';

import {
  addIssueToProject,
  issueCountOptions,
  issueKeys,
  issueListOptions,
  refreshIssues,
} from './api';

export { PULL_MAX };

/**
 * Status chips (11·15). Labels follow POL-I-3 via ISSUE_STATUS_LABELS. No "일정 없음" chip
 * (user decision 2026-11-08): `?view=unscheduled` is reached only from 15's calendar link.
 */
export const STATUS_CHIPS = [
  { status: null, label: '전체' },
  { status: 'TODO', label: ISSUE_STATUS_LABELS.TODO },
  { status: 'IN_PROGRESS', label: ISSUE_STATUS_LABELS.IN_PROGRESS },
  { status: 'BLOCKED', label: ISSUE_STATUS_LABELS.BLOCKED },
  { status: 'DONE', label: ISSUE_STATUS_LABELS.DONE },
] as const;
export type ChipStatus = (typeof STATUS_CHIPS)[number]['status'];

const SEARCH_DELAY_MS = 300;

/** Seconds left until the next refresh is allowed (`null` = allowed now) */
function useCooldown() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  const left = until === null ? null : Math.max(1, Math.ceil((until - now) / 1000));
  return {
    left,
    start: (seconds: number) => {
      // One clock read: two reads a millisecond apart round up to seconds + 1.
      const started = Date.now();
      setNow(started);
      setUntil(started + seconds * 1000);
    },
  };
}

function searchText(draft: string) {
  return draft.trim().slice(0, ISSUE_SEARCH_MAX_LENGTH) || null;
}

export function useIssueList(teamId: string) {
  const viewer = useViewer();
  const client = useQueryClient();
  const [view, setView] = useQueryState(
    'view',
    issueViewParser.withOptions({ history: 'replace' }),
  );
  const [filters, setFilters] = useQueryStates(issueFilterParsers, { history: 'replace' });
  // Search box: typed locally, written to `?q=` after a short pause or on Enter
  const [q, setQ] = useQueryState('q', issueSearchParser.withOptions({ history: 'replace' }));
  const [draft, setDraft] = useState(q ?? '');
  const applySearch = useCallback(
    (next: string | null) => {
      void setQ(next);
      // The unscheduled endpoint has no search: searching shows all issues again
      if (next && view === 'unscheduled') void setView(null);
    },
    [setQ, setView, view],
  );
  useEffect(() => {
    const next = searchText(draft);
    if (next === q) return;
    const timer = window.setTimeout(() => applySearch(next), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, q, applySearch]);
  const search = {
    q,
    draft,
    setDraft,
    submit: (event: FormEvent) => {
      event.preventDefault();
      applySearch(searchText(draft));
    },
  };
  const issues = useInfiniteQuery(issueListOptions(teamId, view, filters, q));
  const cooldown = useCooldown();

  // Chip counts follow the other filters and the search, never the chip's own status
  const scope = { ...issueFilterParams({ ...filters, status: null }), q: q ?? undefined };
  const counts = useQueries({
    queries: [
      ...STATUS_CHIPS.map((chip) =>
        issueCountOptions(teamId, chip.status ? { ...scope, status: chip.status } : scope),
      ),
    ],
  });
  const chipCounts = counts.map((query) => query.data);

  const refresh = useMutation({
    mutationFn: () => refreshIssues(teamId, view, filters),
    onSuccess: async () => {
      cooldown.start(ISSUE.refreshIntervalSeconds);
      await client.invalidateQueries({ queryKey: issueKeys.team(teamId) });
      toast('GitHub에서 최신 이슈를 불러왔어요.');
    },
    onError: (error) => {
      // The shared handler already toasts RATE_LIMITED; keep the button waiting just as long
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        const seconds = Number(error.detail?.retryAfterSeconds);
        cooldown.start(
          Number.isFinite(seconds) && seconds > 0 ? seconds : ISSUE.refreshIntervalSeconds,
        );
      }
    },
  });

  const addToProject = useMutation({
    mutationFn: (issueId: number) => addIssueToProject(teamId, issueId),
    onSuccess: async () => {
      toast('프로젝트에 추가했어요.');
      await client.invalidateQueries({ queryKey: issueKeys.team(teamId) });
    },
    onError: () =>
      toast('프로젝트에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.', { tone: 'alert' }),
  });

  const refreshBlocked = refresh.isPending || cooldown.left !== null;
  const pull = usePullToRefresh({ onRefresh: () => refresh.mutate(), disabled: refreshBlocked });

  const pages = issues.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total;
  const canWrite = (pages[0]?.canWrite ?? false) && viewer.status !== 'SUSPENDED';
  const filtered = view === 'all' && (activeFilterCount(filters) > 0 || q !== null);

  function onRefreshClick() {
    if (cooldown.left !== null) {
      toast(`${cooldown.left}초 후에 다시 새로 고칠 수 있어요.`);
      return;
    }
    if (!refresh.isPending) refresh.mutate();
  }

  function selectStatus(status: ChipStatus) {
    void setView(null);
    void setFilters({ status });
  }

  // Next page when the end of the list scrolls into view (Figma has no "더 보기")
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = issues;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    view,
    status: view === 'all' ? filters.status : null,
    selectStatus,
    chipCounts,
    search,
    issues,
    cooldown,
    refresh,
    addToProject,
    pull,
    items,
    total,
    canWrite,
    filtered,
    onRefreshClick,
    sentinel,
  };
}
