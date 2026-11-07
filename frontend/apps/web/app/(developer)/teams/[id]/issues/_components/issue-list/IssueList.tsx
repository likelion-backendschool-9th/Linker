'use client';

import { Plus, RefreshCw } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { formatDate } from '@/lib/format/time';

import { IssueFilterButton } from '../../../_components/issue-filter-button';
import { IssueStatusBadge } from '../../../../../_components/issue-status-badge';
import type { IssueListView, IssueRow as IssueRowData } from './api';
import styles from './IssueList.module.css';
import { PULL_MAX, useIssueList, VIEW_LABELS } from './hook';
import rowStyles from '../issue-row.module.css';
import pullStyles from '../pull-indicator.module.css';

/** 11 Issue list: 전체 / 일정 없음 tabs, filters, refresh, "이슈 작성" (07 TODO 11) */
export function IssueList({ teamId }: { teamId: string }) {
  const {
    view,
    setView,
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
  } = useIssueList(teamId);

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
              onClick={() => setView(item)}
            >
              {VIEW_LABELS[item]}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          {view === 'all' && <IssueFilterButton />}
          {/* aria-disabled, not disabled: stays focusable so the seconds left are read (blueprint §9-1) */}
          <Button variant="soft" aria-disabled={refreshBlocked} onClick={onRefreshClick}>
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
        <IssueStatusBadge status={issue.status} statusColor={issue.statusColor} />
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
