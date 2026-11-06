'use client';

// client boundary: team list query and URL filter
import { ArrowRight, FolderGit2, MessageCircle, Plus, Users } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { teamEntryHref } from '@/features/teams/team-entry';
import { collaborationLinks } from '@/lib/navigation/collaboration-links';

import type { MyTeam } from './api';
import { FILTERS, LABELS, useWorkspaceTeams, useWorkspaceView } from './hook';

export function WorkspaceView() {
  const { myIssuesHref } = useWorkspaceView();
  return (
    <div className={styles.stack}>
      <section
        className={`${styles.card} ${styles.section}`}
        aria-labelledby="workspace-issues-title"
      >
        <div className={styles.heading}>
          <h2 id="workspace-issues-title" className={styles.title}>
            내 이슈
          </h2>
          <Button asChild variant="outline">
            <Link href={myIssuesHref}>
              내 이슈 전체 보기
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <p className={styles.description}>
          선택한 팀에서 나에게 배정된 이슈를 마감일 순으로 확인해요.
        </p>
      </section>
      <div className={styles.actions}>
        <Button asChild variant="soft">
          <Link href={collaborationLinks.myStats}>내 통계</Link>
        </Button>
      </div>
      <WorkspaceTeams />
    </div>
  );
}

// own region: a team-list failure must not hide C's issue entry or B's statistics entry
function WorkspaceTeams() {
  const { teams, filter, setFilter, activeCount, teamLimit, atLimit, items } = useWorkspaceTeams();
  if (teams.isPending) return <Skeleton variant="card" count={3} />;
  if (teams.isError) return <ErrorState onRetry={() => void teams.refetch()} />;

  return (
    <div className={styles.stack}>
      <div className={styles.heading}>
        <div className={styles.section}>
          <p className={styles.description}>함께하는 팀과 프로젝트를 한곳에서 확인해요.</p>
          <p className={styles.meta}>
            참여 중인 팀 {activeCount}/{teamLimit} · 보관된 팀 제외
          </p>
        </div>
        {atLimit ? (
          <Button disabled>팀 만들기</Button>
        ) : (
          <Button asChild>
            <Link href="/teams/new">
              <Plus aria-hidden />팀 만들기
            </Link>
          </Button>
        )}
      </div>
      {atLimit && <p className={styles.description}>팀은 {teamLimit}개까지 참여할 수 있어요.</p>}
      <div className={styles.actions} role="group" aria-label="팀 상태 필터">
        {FILTERS.map((value) => (
          <Button
            key={value}
            variant={filter === value ? 'primary' : 'soft'}
            aria-pressed={filter === value}
            onClick={() => void setFilter(value)}
          >
            {LABELS[value]}{' '}
            {value === 'all'
              ? teams.data.items.length
              : teams.data.items.filter((t) => t.status === value).length}
          </Button>
        ))}
      </div>
      <section className={styles.section} aria-labelledby="my-teams-title">
        <div className={styles.heading}>
          <h2 id="my-teams-title" className={styles.title}>
            내 팀
          </h2>
          <span className={styles.meta}>{items.length}개</span>
        </div>
        {!items.length ? (
          <EmptyState
            title={
              teams.data.items.length ? '이 상태의 팀이 없어요.' : '아직 함께하는 팀이 없어요.'
            }
            description="새 팀을 만들거나 함께할 팀을 찾아보세요."
            action={
              <div className={styles.actions}>
                {atLimit ? (
                  <Button disabled>팀 만들기</Button>
                ) : (
                  <Button asChild>
                    <Link href="/teams/new">팀 만들기</Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href={'/recruits' as Route}>팀 찾으러 가기</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <div className={styles.stack}>
            {(['ACTIVE', 'COMPLETED', 'READ_ONLY', 'ARCHIVED'] as const)
              .filter((status) => items.some((team) => team.status === status))
              .map((status) => (
                <section
                  key={status}
                  className={styles.section}
                  aria-labelledby={`workspace-group-${status}`}
                >
                  <h3 id={`workspace-group-${status}`} className={styles.label}>
                    {LABELS[status]} · {items.filter((team) => team.status === status).length}개
                  </h3>
                  <ul className={styles.grid}>
                    {items
                      .filter((team) => team.status === status)
                      .map((team) => (
                        <li key={team.id}>
                          <WorkspaceTeamCard team={team} />
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

function WorkspaceTeamCard({ team }: { team: MyTeam }) {
  const href = teamEntryHref(team);
  const content = (
    <>
      <div className={styles.row}>
        {team.orgAvatarUrl ? (
          <Image
            className={styles.avatar}
            src={team.orgAvatarUrl}
            alt=""
            width={48}
            height={48}
            sizes="48px"
          />
        ) : (
          <Users size={48} aria-hidden className={styles.avatar} />
        )}
        <div className={styles.body}>
          <h4 id={`team-${team.id}`} className={styles.cardTitle}>
            {team.name}
          </h4>
          <span className={styles.meta}>
            {team.myRole === 'OWNER' ? '오너' : team.myRole === 'ADMIN' ? '관리자' : '멤버'}
          </span>
        </div>
        {href && <ArrowRight aria-hidden />}
      </div>
      <div className={styles.heading}>
        <span className={styles.badge}>{LABELS[team.status]}</span>
        {(team.plan === 'FREE' || team.plan === 'FLEX') && (
          <span className={styles.badge}>{team.plan === 'FLEX' ? 'Flex' : 'Free'}</span>
        )}
      </div>
      <div className={styles.actions}>
        <span className={styles.row}>
          <Users size={16} aria-hidden />
          {team.memberCount}명
        </span>
        {team.openIssueCount !== null && (
          <span className={styles.row}>
            <FolderGit2 size={16} aria-hidden />
            열린 이슈 {team.openIssueCount}개
          </span>
        )}
        {team.unreadCount !== null && team.unreadCount > 0 && (
          <span className={styles.row}>
            <MessageCircle size={16} aria-hidden />안 읽은 메시지 {team.unreadCount}개
          </span>
        )}
      </div>
    </>
  );
  return (
    <article aria-labelledby={`team-${team.id}`}>
      {href ? (
        <Link className={`${styles.card} ${styles.linkCard}`} href={href}>
          {content}
        </Link>
      ) : (
        <div className={`${styles.card} ${styles.linkCard}`} aria-disabled="true">
          {content}
          <p className={styles.description}>채팅방을 찾지 못했어요</p>
        </div>
      )}
    </article>
  );
}
