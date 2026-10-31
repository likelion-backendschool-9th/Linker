'use client';

// Client boundary: URL tab and filters, refresh (button + pull gesture) cooldown, "프로젝트에 추가"
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useQueryState, useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { ISSUE } from '@/lib/policy';
import { toast } from '@/stores/toast-store';

import { IssueFilterButton } from '../../_components/issue-filter-button';
import { activeFilterCount, issueFilterParsers } from '../../_lib/issue-filters';
import {
  addIssueToProject,
  issueKeys,
  issueListOptions,
  refreshIssues,
  type IssueListView,
} from '../../_lib/issue-queries';
import { usePullToRefresh } from '../_hooks/use-pull-to-refresh';
import { issueViewParser } from '../_lib/issue-view';
import styles from './issue-list.module.css';
import { IssueRow } from './issue-row';
import { PullIndicator } from './pull-indicator';

const VIEW_LABELS: Record<IssueListView, string> = { all: '전체', unscheduled: '일정 없음' };

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

/** 11 Issue list: 전체 / 일정 없음 tabs, filters, refresh, "이슈 작성" (07 TODO 11) */
export function IssueList({ teamId }: { teamId: string }) {
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
    mutationFn: () => refreshIssues(teamId),
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

  const pull = usePullToRefresh({
    onRefresh: () => refresh.mutate(),
    disabled: refresh.isPending || cooldown.left !== null,
  });

  const pages = issues.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  const canWrite = (pages[0]?.canWrite ?? false) && viewer.status !== 'SUSPENDED';
  const filtered = view === 'all' && activeFilterCount(filters) > 0;

  return (
    <>
      <PullIndicator distance={pull.distance} ready={pull.ready} waitSeconds={cooldown.left} />
      <div className={styles.toolbar}>
        <div className={styles.views} role="group" aria-label="이슈 보기">
          {(Object.keys(VIEW_LABELS) as IssueListView[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={view === item}
              className={styles.view}
              onClick={() => void setView(item)}
            >
              {VIEW_LABELS[item]}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          {view === 'all' && <IssueFilterButton />}
          <Button
            variant="soft"
            disabled={refresh.isPending || cooldown.left !== null}
            onClick={() => refresh.mutate()}
          >
            <RefreshCw aria-hidden />
            {refresh.isPending
              ? '불러오는 중…'
              : cooldown.left !== null
                ? `${cooldown.left}초 후 새로 고침`
                : '새로 고침'}
          </Button>
          {canWrite && (
            <Button asChild>
              <Link href={`/teams/${teamId}/issues/new` as Route}>
                <Plus aria-hidden />
                이슈 작성
              </Link>
            </Button>
          )}
        </div>
      </div>

      {view === 'unscheduled' && (
        <p className={styles.note}>
          보드에 없거나 마감일이 없는 이슈예요. 캘린더와 보드에는 보이지 않아요.
        </p>
      )}

      <section
        aria-label={`${VIEW_LABELS[view]} 이슈 목록`}
        aria-busy={issues.isPending}
        className={styles.content}
      >
        {issues.isPending ? (
          <>
            <p role="status">이슈를 불러오고 있어요.</p>
            <Skeleton count={4} />
          </>
        ) : issues.isError && !issues.data ? (
          <ErrorState onRetry={() => void issues.refetch()} />
        ) : items.length === 0 ? (
          view === 'unscheduled' ? (
            <EmptyState
              title="일정이 없는 이슈가 없어요."
              description="모든 이슈가 보드와 캘린더에 들어가 있어요."
            />
          ) : filtered ? (
            <EmptyState title="조건에 맞는 이슈가 없어요." description="필터를 바꿔 보세요." />
          ) : (
            <EmptyState
              title="아직 이슈가 없어요."
              description={
                canWrite
                  ? '첫 이슈를 작성해 팀의 할 일을 나눠 보세요.'
                  : 'GitHub에서 만든 이슈도 여기에 보여요.'
              }
            />
          )
        ) : (
          <>
            <p className={styles.count} role="status">
              이슈 {total}개
            </p>
            <ul className={styles.list}>
              {items.map((issue) => (
                <li key={issue.id}>
                  <IssueRow
                    teamId={teamId}
                    issue={issue}
                    action={
                      view === 'unscheduled' && !issue.inProject && canWrite ? (
                        <Button
                          variant="outline"
                          disabled={addToProject.isPending}
                          onClick={() => addToProject.mutate(issue.id)}
                        >
                          프로젝트에 추가
                          <span className="sr-only">: {issue.title}</span>
                        </Button>
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        {issues.isError && issues.data && (
          <ErrorState title="목록을 갱신하지 못했어요" onRetry={() => void issues.refetch()} />
        )}
        {issues.hasNextPage && (
          <Button
            variant="soft"
            block
            disabled={issues.isFetchingNextPage}
            onClick={() => void issues.fetchNextPage()}
          >
            {issues.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </Button>
        )}
      </section>
    </>
  );
}
