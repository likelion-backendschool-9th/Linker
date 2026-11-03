'use client';

// client boundary: team list query and URL filter
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FolderGit2, Plus, Users } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { TEAM } from '@/lib/policy';
import { collaborationLinks } from '@/lib/navigation/collaboration-links';

import { myTeamsOptions } from '../../teams/[id]/_lib/team-queries';

const FILTERS = ['all', 'ACTIVE', 'COMPLETED', 'READ_ONLY', 'ARCHIVED'] as const;
const LABELS = {
  all: '전체',
  ACTIVE: '활동 중',
  COMPLETED: '완료',
  READ_ONLY: '읽기 전용',
  ARCHIVED: '보관됨',
};

export function WorkspaceView() {
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
            <Link href={collaborationLinks.myIssues}>
              내 이슈 전체 보기
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <p className={styles.description}>
          모든 팀에서 나에게 배정된 이슈를 마감일 순으로 확인해요.
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
  const teams = useQuery(myTeamsOptions());
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringLiteral(FILTERS).withDefault('all'),
  );
  if (teams.isPending) return <Skeleton variant="card" count={3} />;
  if (teams.isError) return <ErrorState onRetry={() => void teams.refetch()} />;
  const activeCount = teams.data.items.filter((team) => team.status !== 'ARCHIVED').length;
  const atLimit = activeCount >= TEAM.maxTeamsPerUser;
  const items = teams.data.items.filter((team) => filter === 'all' || team.status === filter);

  return (
    <div className={styles.stack}>
      <div className={styles.heading}>
        <div className={styles.section}>
          <p className={styles.description}>함께하는 팀과 프로젝트를 한곳에서 확인해요.</p>
          <p className={styles.meta}>
            참여 중인 팀 {activeCount}/{TEAM.maxTeamsPerUser} · 보관된 팀 제외
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
      {atLimit && (
        <p className={styles.description}>팀은 {TEAM.maxTeamsPerUser}개까지 참여할 수 있어요.</p>
      )}
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
                          <article aria-labelledby={`team-${team.id}`}>
                            <Link
                              className={`${styles.card} ${styles.linkCard}`}
                              href={
                                (team.status === 'ARCHIVED'
                                  ? `/chats/${team.chatRoomId}`
                                  : `/teams/${team.id}/issues`) as Route
                              }
                            >
                              <div className={styles.row}>
                                <Image
                                  className={styles.avatar}
                                  src={team.orgAvatarUrl}
                                  alt=""
                                  width={48}
                                  height={48}
                                  sizes="48px"
                                />
                                <div className={styles.body}>
                                  <h4 id={`team-${team.id}`} className={styles.cardTitle}>
                                    {team.name}
                                  </h4>
                                  <span className={styles.meta}>
                                    {team.myRole === 'OWNER'
                                      ? '오너'
                                      : team.myRole === 'ADMIN'
                                        ? '관리자'
                                        : '멤버'}
                                  </span>
                                </div>
                                <ArrowRight aria-hidden />
                              </div>
                              <div className={styles.heading}>
                                <span className={styles.badge}>{LABELS[team.status]}</span>
                                <span className={styles.badge}>
                                  {team.plan === 'FLEX' ? 'Flex' : 'Free'}
                                </span>
                              </div>
                              <div className={styles.actions}>
                                <span className={styles.row}>
                                  <Users size={16} aria-hidden />
                                  {team.memberCount}명
                                </span>
                                <span className={styles.row}>
                                  <FolderGit2 size={16} aria-hidden />
                                  열린 이슈 {team.openIssueCount}개
                                </span>
                              </div>
                            </Link>
                          </article>
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
