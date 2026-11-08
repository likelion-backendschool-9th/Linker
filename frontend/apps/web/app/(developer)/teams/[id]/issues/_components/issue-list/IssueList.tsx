'use client';

// client boundary: URL chips/search (nuqs), list query, pull to refresh
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { MagnifierLinearIcon } from '@solar-icons/static/linear/magnifier';
import { RefreshCw } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';

import { IssueSummaryRow } from '../../../../../_components/issue-summary-row';
import { ISSUE_SEARCH_MAX_LENGTH } from '../../_lib/issue-view';
import { PULL_MAX, STATUS_CHIPS, useIssueList } from './hook';
import styles from './IssueList.module.css';
import pullStyles from '../pull-indicator.module.css';

const withCount = (label: string, count: number | undefined) =>
  count === undefined ? label : `${label} ${count}`;

/**
 * "이슈 목록" of 11 (Figma 197:66, focus 368:1716): count, "+" (이슈 작성), title search, status chips,
 * issue rows. `?view=unscheduled` (from 15's calendar link only, no chip) lists 일정 없음 issues with
 * "프로젝트에 추가". Pull to refresh refreshes this screen's issues once a minute.
 */
export function IssueList({ teamId }: { teamId: string }) {
  const {
    view,
    status,
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
  } = useIssueList(teamId);

  return (
    <section aria-labelledby="issue-list-title" className={styles.section}>
      <PullIndicator distance={pull.distance} ready={pull.ready} waitSeconds={cooldown.left} />
      <div className={styles.heading}>
        <h2 id="issue-list-title" className={styles.title}>
          이슈 목록 <span className={styles.count}>{total === undefined ? '' : `${total}개`}</span>
        </h2>
        {/* Keyboard and screen-reader alternative to the pull gesture; shown only when focused */}
        <button
          type="button"
          className={styles.refresh}
          aria-disabled={refresh.isPending || cooldown.left !== null}
          onClick={onRefreshClick}
        >
          {refresh.isPending
            ? '불러오는 중…'
            : cooldown.left !== null
              ? `${cooldown.left}초 후 새로 고침`
              : '새로 고침'}
        </button>
        {canWrite && (
          <Link href={`/teams/${teamId}/issues/new` as Route} className={styles.create}>
            {/* Figma solar:add-bold (package SVG string) */}
            <span
              aria-hidden
              className={styles.createIcon}
              dangerouslySetInnerHTML={{ __html: AddBoldIcon }}
            />
            <span className="sr-only">이슈 작성</span>
          </Link>
        )}
      </div>

      <form role="search" className={styles.search} onSubmit={search.submit}>
        <label htmlFor="issue-search" className="sr-only">
          이슈 제목 검색
        </label>
        {/* Figma solar:magnifier-linear with a 2px line (package SVG string) */}
        <span
          aria-hidden
          className={styles.searchIcon}
          dangerouslySetInnerHTML={{ __html: MagnifierLinearIcon }}
        />
        <input
          id="issue-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={ISSUE_SEARCH_MAX_LENGTH}
          placeholder="검색어를 입력해 주세요"
          className={styles.searchInput}
          value={search.draft}
          onChange={(event) => search.setDraft(event.target.value)}
        />
      </form>

      <div className={styles.chips} role="group" aria-label="이슈 상태">
        {STATUS_CHIPS.map((chip, index) => (
          <button
            key={chip.label}
            type="button"
            className={styles.chip}
            aria-pressed={view === 'all' && status === chip.status}
            onClick={() => selectStatus(chip.status)}
          >
            {withCount(chip.label, chipCounts[index])}
          </button>
        ))}
      </div>

      <div aria-busy={issues.isPending} className={styles.content}>
        {issues.isPending ? (
          <>
            <p role="status" className="sr-only">
              이슈를 불러오고 있어요.
            </p>
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
          ) : filtered || status !== null ? (
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
          <ul className={styles.list}>
            {items.map((issue) => (
              <li key={issue.id}>
                <IssueSummaryRow
                  teamId={teamId}
                  issue={issue}
                  action={
                    view === 'unscheduled' && !issue.inProject && canWrite ? (
                      <button
                        type="button"
                        className={styles.addToProject}
                        disabled={addToProject.isPending}
                        onClick={() => addToProject.mutate(issue.id)}
                      >
                        프로젝트에 추가
                        <span className="sr-only">: {issue.title}</span>
                      </button>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {issues.isError && issues.data && (
          <ErrorState title="목록을 갱신하지 못했어요" onRetry={() => void issues.refetch()} />
        )}
        {issues.hasNextPage && <div ref={sentinel} className={styles.sentinel} aria-hidden />}
        {issues.isFetchingNextPage && (
          <p role="status" className="sr-only">
            이슈를 더 불러오고 있어요.
          </p>
        )}
      </div>
    </section>
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
 * What the pull gesture will do. Visual only (`aria-hidden`): the focus-only "새로 고침" button says
 * the same and the result is announced by a toast. Moves with transform/opacity only.
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
