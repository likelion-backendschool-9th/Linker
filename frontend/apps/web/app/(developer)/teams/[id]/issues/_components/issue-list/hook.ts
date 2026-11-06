'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryState, useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { ISSUE } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { activeFilterCount, issueFilterParsers } from '../../../_lib/issue-filters';
import { PULL_MAX, usePullToRefresh } from '../../_hooks/use-pull-to-refresh';
import { issueViewParser } from '../../_lib/issue-view';
import {
  addIssueToProject,
  issueKeys,
  issueListOptions,
  refreshIssues,
  type IssueListView,
} from './api';

export const VIEW_LABELS: Record<IssueListView, string> = { all: '전체', unscheduled: '일정 없음' };
export { PULL_MAX };

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
      setNow(Date.now());
      setUntil(Date.now() + seconds * 1000);
    },
  };
}

export function useIssueList(teamId: string) {
  const viewer = useViewer();
  const client = useQueryClient();
  const [view, setView] = useQueryState(
    'view',
    issueViewParser.withOptions({ history: 'replace' }),
  );
  const [filters] = useQueryStates(issueFilterParsers);
  const issues = useInfiniteQuery(issueListOptions(teamId, view, filters));
  const cooldown = useCooldown();

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
  const total = pages[0]?.total ?? 0;
  const canWrite = (pages[0]?.canWrite ?? false) && viewer.status !== 'SUSPENDED';
  const filtered = view === 'all' && activeFilterCount(filters) > 0;

  function onRefreshClick() {
    if (cooldown.left !== null) {
      toast(`${cooldown.left}초 후에 다시 새로 고칠 수 있어요.`);
      return;
    }
    if (!refresh.isPending) refresh.mutate();
  }

  return {
    view,
    setView: (item: IssueListView) => void setView(item),
    issues,
    cooldown,
    refresh,
    addToProject,
    refreshBlocked,
    pull,
    items,
    total,
    canWrite,
    filtered,
    onRefreshClick,
  };
}
