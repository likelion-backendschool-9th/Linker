'use client';

// Client boundary: URL-backed selection and C's existing my-issues query.
import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowDownLinearIcon } from '@solar-icons/static/linear/alt-arrow-down';
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import { ArrowRightUpLinearIcon } from '@solar-icons/static/linear/arrow-right-up';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { teamEntryHref } from '@/features/teams/team-entry';
import { PLAN_LIMITS } from '@/lib/policy';

import { IssueSummaryRow } from '../../../_components/issue-summary-row';
import { WorkspaceTeamSheet } from '../workspace-team-sheet/WorkspaceTeamSheet';
import type { MyTeam } from './api';
import { FILTERS, LABELS, useWorkspaceView } from './hook';
import styles from './WorkspaceView.module.css';

/** Figma 7 (123:1966). C's full-list route and shared components stay independent. */
export function WorkspaceView() {
  const {
    teams,
    team,
    issues,
    selectTeam,
    overlay,
    myIssuesHref,
    filter,
    setFilter,
    items,
    atLimit,
  } = useWorkspaceView();
  if (teams.isPending) return <Skeleton variant="card" count={3} />;
  if (teams.isError)
    return (
      <div className={styles.workspace}>
        <ErrorState onRetry={() => void teams.refetch()} />
        <Link href={myIssuesHref} className={styles.more} aria-label="내 이슈 전체 보기">
          내 이슈 전체 보기 <Icon svg={ArrowRightUpLinearIcon} className={styles.moreIcon} />
        </Link>
      </div>
    );
  const selectedHref = team ? teamEntryHref(team) : null;
  return (
    <div className={styles.workspace}>
      {team && (
        <div className={styles.preview}>
          <section className={styles.teamPicker} aria-labelledby="workspace-teams-title">
            <h2 id="workspace-teams-title" className={styles.sectionTitle}>
              팀 목록
            </h2>
            <div className={styles.selectedCard}>
              <WorkspaceTeamSheet
                overlay={overlay}
                trigger={
                  <button type="button" className={styles.teamTrigger}>
                    <span className="sr-only">팀 변경, 현재 {team.name}</span>
                    <span aria-hidden className={styles.teamContent}>
                      <TeamAvatar team={team} selected />
                      <span className={styles.selectedSummary}>
                        <span className={styles.selectedName}>{team.name}</span>
                        <span className={styles.selectedMeta}>
                          <MemberCount team={team} />
                        </span>
                      </span>
                    </span>
                  </button>
                }
                teams={teams.data.items}
                selectedId={team.id}
                onSubmit={(id) => void overlay.closeAnd(() => selectTeam(id))}
              />
              {selectedHref && (
                <Link href={selectedHref} className={styles.entry}>
                  <Icon
                    svg={overlay.isOpen ? AltArrowDownLinearIcon : AltArrowRightLinearIcon}
                    className={styles.chevron}
                  />
                  <span className="sr-only">{team.name} 팀으로 이동</span>
                </Link>
              )}
            </div>
          </section>
          <section className={styles.issues} aria-labelledby="workspace-issues-title">
            <div className={styles.issueHeading}>
              <h2 id="workspace-issues-title" className={styles.sectionTitle}>
                내 {team.name} 팀의 이슈
              </h2>
              {['ACTIVE', 'COMPLETED'].includes(team.status) && (
                <Link href={`/teams/${team.id}/issues/new` as Route} className={styles.addIssue}>
                  <Icon svg={AddBoldIcon} className={styles.addIssueIcon} />
                  <span className="sr-only">이슈 작성</span>
                </Link>
              )}
            </div>
            {issues.isPending ? (
              <Skeleton count={3} />
            ) : issues.isError ? (
              <ErrorState onRetry={() => void issues.refetch()} />
            ) : issues.data?.items.length ? (
              <ul>
                {issues.data.items.slice(0, 3).map((issue) => (
                  <li key={issue.id}>
                    <IssueSummaryRow teamId={team.id} issue={issue} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="배정된 이슈가 없어요." />
            )}
            <Link
              href={myIssuesHref}
              className={styles.more}
              aria-label="내 이슈 전체 보기"
            >
              내 이슈 전체 보기 <Icon svg={ArrowRightUpLinearIcon} className={styles.moreIcon} />
            </Link>
          </section>
        </div>
      )}
      <section className={styles.teamList} aria-label="내 팀">
        <div className={styles.tabs} role="group" aria-label="팀 상태 필터">
          {FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={styles.tab}
              aria-label={`${LABELS[status]} ${teams.data.items.filter((item) => item.status === status).length}`}
              aria-pressed={filter === status}
              onClick={() => void setFilter(status)}
            >
              <span>{LABELS[status]}</span>{' '}
              <span>{teams.data.items.filter((item) => item.status === status).length}</span>
            </button>
          ))}
        </div>
        {!teams.data.items.length ? (
          <div className={styles.empty}>
            <EmptyState
              title="아직 함께하는 팀이 없어요."
              action={
                <div className={styles.emptyActions}>
                  {atLimit ? (
                    <Button disabled>팀 만들기</Button>
                  ) : (
                    <Button asChild>
                      <Link href="/teams/new">팀 만들기</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href="/recruits">팀 찾으러 가기</Link>
                  </Button>
                </div>
              }
            />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState title="이 상태의 팀이 없어요." />
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <TeamRow team={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {atLimit ? (
        <button type="button" className={styles.fab} disabled aria-label="팀 만들기">
          <Icon svg={AddBoldIcon} />
        </button>
      ) : (
        <Link href="/teams/new" className={styles.fab}>
          <Icon svg={AddBoldIcon} />
          <span className="sr-only">팀 만들기</span>
        </Link>
      )}
    </div>
  );
}

function TeamAvatar({ team, selected = false }: { team: MyTeam; selected?: boolean }) {
  const className = selected ? styles.selectedAvatar : styles.avatar;
  return team.orgAvatarUrl ? (
    <Image
      className={className}
      src={team.orgAvatarUrl}
      alt=""
      width={selected ? 50 : 38}
      height={selected ? 50 : 38}
      sizes={selected ? '50px' : '38px'}
    />
  ) : (
    <span className={className} aria-hidden />
  );
}

function MemberCount({ team }: { team: MyTeam }) {
  // Unknown plan is not Free; Flex has no member cap. Never invent a denominator.
  return (
    <>
      멤버 {team.memberCount}
      {team.plan === 'FREE' ? `/${PLAN_LIMITS.teamMembers.free}` : ''}
    </>
  );
}

function TeamRow({ team }: { team: MyTeam }) {
  const href = teamEntryHref(team);
  const content = (
    <>
      <span className={styles.teamContent}>
        <TeamAvatar team={team} />
        <span className={styles.rowSummary}>
          <span className={styles.rowName}>{team.name}</span>
          <span className={styles.rowMeta}>
            <MemberCount team={team} />
          </span>
        </span>
      </span>
      {href && <Icon svg={AltArrowRightLinearIcon} className={styles.chevron} />}
      <span className="sr-only">{LABELS[team.status]}</span>
    </>
  );
  return (
    <article aria-label={team.name}>
      {href ? (
        <Link href={href} className={styles.row}>
          {content}
        </Link>
      ) : (
        <div className={styles.row} aria-disabled="true">
          {content}
        </div>
      )}
    </article>
  );
}
