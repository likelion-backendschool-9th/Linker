'use client';

// Client boundary: URL tab and filters, refresh (button + pull gesture) cooldown, "프로젝트에 추가"
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryState, useQueryStates } from 'nuqs';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/api-error';
import { useViewer } from '@/lib/auth/viewer-context';
import { formatDate } from '@/lib/format/time';
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
  type IssueRow as IssueRowData,
} from '../../_lib/issue-queries';
import { ISSUE_STATUS_LABELS } from '../../../../_lib/issue-status';
import { PULL_MAX, usePullToRefresh } from '../_hooks/use-pull-to-refresh';
import { issueViewParser } from '../_lib/issue-view';
import styles from './issue-list.module.css';
import rowStyles from './issue-row.module.css';
import pullStyles from './pull-indicator.module.css';

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
          {/* aria-disabled, not disabled: stays focusable so the seconds left are read (blueprint §9-1) */}
          <Button
            variant="soft"
            aria-disabled={refreshBlocked}
            onClick={() => {
              if (cooldown.left !== null) {
                toast(`${cooldown.left}초 후에 다시 새로 고칠 수 있어요.`);
                return;
              }
              if (!refresh.isPending) refresh.mutate();
            }}
            pending={refresh.isPending}
            pendingLabel="불러오는 중…"
          >
            <RefreshCw aria-hidden />
            {cooldown.left !== null
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
          <LoadingIndicator label="이슈를 불러오고 있어요." variant="block">
            <Skeleton count={4} />
          </LoadingIndicator>
        ) : issues.isError && !issues.data ? (
          <ErrorState onRetry={() => void issues.refetch()} />
        ) : items.length === 0 ? (
          view === 'unscheduled' ? (
            <EmptyState
              title="일정이 없는 이슈가 없어요."
              description="모든 이슈가 보드와 캘린더에 들어가 있어요."
            />
          ) : filtered ? (
            <EmptyState title="조건에 맞는 이슈가 없어요." description="필터를 줄여 보세요." />
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
                          pending={addToProject.isPending && addToProject.variables === issue.id}
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
            pending={issues.isFetchingNextPage}
            pendingLabel="불러오는 중…"
          >
            더 보기
          </Button>
        )}
      </section>
    </>
  );
}

type IssueRowProps = {
  teamId: string;
  issue: IssueRowData;
  /** Row action, e.g. "프로젝트에 추가" on the "일정 없음" tab */
  action?: ReactNode;
};

const MAX_AVATARS = 3;

/**
 * One issue: repo, number, title, status, assignees, due date, labels, overdue mark (07 TODO 11).
 * The title links to the issue detail (12).
 */
function IssueRow({ teamId, issue, action }: IssueRowProps) {
  const titleId = `issue-${issue.id}-title`;
  const shown = issue.assignees.slice(0, MAX_AVATARS);
  const hidden = issue.assignees.length - shown.length;
  const outside = issue.assignees.filter((user) => !user.inTeam).length;

  return (
    <article aria-labelledby={titleId} className={rowStyles.row}>
      <p className={rowStyles.repo}>
        {issue.repoName} #{issue.number}
      </p>
      <h2 id={titleId} className={rowStyles.title}>
        <Link href={`/teams/${teamId}/issues/${issue.id}` as Route} className={rowStyles.link}>
          {issue.title}
        </Link>
      </h2>

      <div className={rowStyles.meta}>
        <span className={rowStyles.status}>{ISSUE_STATUS_LABELS[issue.status]}</span>
        {issue.dueDate && (
          <span className={issue.overdue ? rowStyles.overdue : rowStyles.due}>
            마감 <time dateTime={issue.dueDate}>{formatDate(issue.dueDate)}</time>
            {issue.overdue && ' · 마감 지남'}
          </span>
        )}
        {issue.assignees.length > 0 ? (
          <span className={rowStyles.assignees}>
            <span className="sr-only">
              담당자{' '}
              {issue.assignees
                .map((user) => (user.inTeam ? user.name : `${user.name}(팀 밖 사용자)`))
                .join(', ')}
            </span>
            {shown.map((user) => (
              <Image
                key={user.id}
                src={user.avatarUrl}
                alt=""
                width={24}
                height={24}
                sizes="24px"
                className={rowStyles.avatar}
              />
            ))}
            {hidden > 0 && (
              <span className={rowStyles.more} aria-hidden>
                +{hidden}
              </span>
            )}
            {outside > 0 && (
              <span className={rowStyles.outside} aria-hidden>
                팀 밖 사용자{outside > 1 ? ` ${outside}명` : ''}
              </span>
            )}
          </span>
        ) : (
          <span className={rowStyles.unassigned}>담당자 없음</span>
        )}
      </div>

      {issue.labels.length > 0 && (
        <ul className={rowStyles.labels} aria-label="라벨">
          {issue.labels.map((label) => (
            <li key={label.name} className={rowStyles.label}>
              {/* GitHub's label color is data, so it's inline; the name always carries the meaning */}
              <span
                className={rowStyles.swatch}
                style={{ backgroundColor: `#${label.color.replace(/^#/, '')}` }}
                aria-hidden
              />
              {label.name}
            </li>
          ))}
        </ul>
      )}

      {issue.scheduleSyncFailed && (
        <p className={rowStyles.warning}>일정이 GitHub에 반영되지 않았어요</p>
      )}
      {action && <div className={rowStyles.action}>{action}</div>}
    </article>
  );
}

type PullIndicatorProps = {
  /** Current pull distance in px (0 = hidden) */
  distance: number;
  ready: boolean;
  /** Seconds until refresh is allowed again; null when allowed */
  waitSeconds: number | null;
};

/**
 * What the pull gesture will do. Visual only (`aria-hidden`): the "새로 고침" button next to it
 * says the same and the result is announced by a toast. Moves with transform/opacity only.
 */
function PullIndicator({ distance, ready, waitSeconds }: PullIndicatorProps) {
  const label =
    waitSeconds !== null
      ? `${waitSeconds}초 후에 새로 고칠 수 있어요`
      : ready
        ? '놓으면 새로 고침'
        : '당겨서 새로 고침';
  const style = {
    '--pull-distance': `${distance}px`,
    '--pull-progress': String(Math.min(distance / PULL_MAX, 1)),
  } as CSSProperties;

  return (
    <div className={pullStyles.indicator} style={style} aria-hidden data-active={distance > 0}>
      <span className={pullStyles.pill}>
        <RefreshCw className={pullStyles.icon} />
        {label}
      </span>
    </div>
  );
}
