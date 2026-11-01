'use client';

// client boundary: read-only team sections and action sheet triggers
import { useQuery } from '@tanstack/react-query';
import { GitBranch, LockKeyhole, Settings2, Users } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import { GitHubMark as Github } from '@/features/github/github-mark';
import styles from '@/features/teams/team-ui.module.css';
import { useViewer } from '@/lib/auth/viewer-context';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { TEAM } from '@/lib/policy';
import {
  collaborationLinks,
  profileHref,
  teamPlanHref,
} from '@/lib/navigation/collaboration-links';

import { invitesOptions, membersOptions, settingsOptions } from '../_lib/settings-queries';
import { TeamSettingsActionSheet } from './team-settings-action-sheet';
import { InviteLinkActions } from './invite-link-actions';

const ROLES = { OWNER: '오너', ADMIN: '관리자', MEMBER: '멤버' };
const ORG_STATUS = {
  MEMBER: 'GitHub 조직 멤버',
  INVITED: 'GitHub 조직 초대 중',
  NOT_MEMBER: 'GitHub 조직 미가입',
};

export function TeamSettingsView({ teamId }: { teamId: string }) {
  const settings = useQuery(settingsOptions(teamId));
  const members = useQuery(membersOptions(teamId));
  const viewer = useViewer();
  const canManage = settings.data?.myRole !== 'MEMBER' && !!settings.data;
  const invites = useQuery({ ...invitesOptions(teamId), enabled: canManage });
  const action = useOverlay('team-settings-action');
  const external = useOpenExternal();
  if (settings.isPending || members.isPending) return <Skeleton variant="card" count={3} />;
  if (settings.isError || members.isError)
    return (
      <ErrorState
        onRetry={() => {
          void settings.refetch();
          void members.refetch();
        }}
      />
    );
  const team = settings.data;
  const editable =
    viewer.status !== 'SUSPENDED' && !['READ_ONLY', 'ARCHIVED'].includes(team.status);
  const permissions = team.permissions;

  return (
    <div className={styles.stack}>
      {!editable && (
        <p className={styles.soft}>
          지금은 팀 설정을 읽을 수만 있어요.
          {team.status === 'READ_ONLY' && ' GitHub 조직에 Linker 앱을 다시 설치해 주세요.'}
        </p>
      )}
      {team.status === 'READ_ONLY' && (
        <Button
          variant="outline"
          onClick={() =>
            external(`https://github.com/organizations/${team.orgLogin}/settings/installations`)
          }
        >
          GitHub 앱 설정 보기
        </Button>
      )}
      {team.ownershipTransfer && (
        <section
          className={`${styles.card} ${styles.section}`}
          aria-labelledby="ownership-request-title"
        >
          <h2 id="ownership-request-title" className={styles.title}>
            소유권 이전 요청
          </h2>
          <p>
            {team.ownershipTransfer.fromName}님이 {team.ownershipTransfer.toName}님에게 소유권
            이전을 요청했어요.
          </p>
          <p className={styles.description}>수락 전까지 현재 오너와 청구 관리자는 바뀌지 않아요.</p>
          {team.ownershipTransfer.isRecipient && (
            <Button
              variant="outline"
              disabled={!editable}
              onClick={() => action.open('accept-transfer')}
            >
              이전 요청 확인
            </Button>
          )}
        </section>
      )}
      {team.ownershipClaim?.eligible && (
        <div className={styles.soft}>
          <p>{team.ownershipClaim.reason}</p>
          <Button variant="outline" disabled={!editable} onClick={() => action.open('claim')}>
            소유권 인수 안내
          </Button>
        </div>
      )}
      <section className={`${styles.card} ${styles.section}`} aria-labelledby="team-info-title">
        <div className={styles.heading}>
          <h2 id="team-info-title" className={styles.title}>
            팀 정보
          </h2>
          {permissions.editInfo && (
            <Button variant="outline" disabled={!editable} onClick={() => action.open('info')}>
              편집
            </Button>
          )}
        </div>
        <dl className={styles.details}>
          <div>
            <dt>팀 이름</dt>
            <dd>{team.name}</dd>
          </div>
          <div>
            <dt>GitHub 조직</dt>
            <dd className={styles.row}>
              <Github width={16} height={16} aria-hidden />
              {team.orgLogin}
            </dd>
          </div>
          <div>
            <dt>팀 소개</dt>
            <dd>{team.description}</dd>
          </div>
          <div>
            <dt>내 역할</dt>
            <dd>{ROLES[team.myRole]}</dd>
          </div>
        </dl>
      </section>
      <section className={`${styles.card} ${styles.section}`} aria-labelledby="team-members-title">
        <div className={styles.heading}>
          <h2 id="team-members-title" className={styles.title}>
            멤버{' '}
            <span className={styles.badge}>
              <Users size={16} aria-hidden />
              {members.data.count}
              {members.data.limit !== null ? `/${members.data.limit}` : '명'}
            </span>
          </h2>
          {permissions.createInviteLink && (
            <Button variant="outline" disabled={!editable} onClick={() => action.open('invite')}>
              초대 링크 만들기
            </Button>
          )}
        </div>
        <ul>
          {members.data.items.map((member) => (
            <li key={member.user.id} className={styles.listRow}>
              <div className={styles.row}>
                <Image
                  className={styles.avatar}
                  src={member.user.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  sizes="40px"
                />
                <div className={styles.body}>
                  <span>
                    <Link href={profileHref(member.user.login)}>
                      {member.user.name}
                      <span className="sr-only"> 프로필 보기</span>
                    </Link>{' '}
                    <span className={styles.badge}>{ROLES[member.role]}</span>
                  </span>
                  <span className={styles.meta}>
                    @{member.user.login} · {ORG_STATUS[member.githubOrgStatus]}
                  </span>
                </div>
              </div>
              {permissions.manageMembers &&
                member.role !== 'OWNER' &&
                (team.myRole === 'OWNER' || member.role === 'MEMBER') && (
                  <Button
                    variant="soft"
                    disabled={!editable}
                    onClick={() => action.open(`member:${member.user.id}`)}
                  >
                    멤버 관리<span className="sr-only"> · {member.user.name}</span>
                  </Button>
                )}
            </li>
          ))}
        </ul>
        {members.data.limit !== null && members.data.count >= members.data.limit && (
          <p className={styles.soft}>
            팀 인원이 가득 찼어요. 새 멤버가 참여하려면 Flex가 필요해요.
          </p>
        )}
      </section>
      {canManage && (
        <section
          className={`${styles.card} ${styles.section}`}
          aria-labelledby="invite-links-title"
        >
          <h2 id="invite-links-title" className={styles.title}>
            초대 링크
          </h2>
          <p className={styles.description}>
            초대 링크는 {TEAM.inviteValidDays}일 동안 사용할 수 있어요.
          </p>
          {invites.isPending ? (
            <Skeleton />
          ) : invites.isError ? (
            <ErrorState onRetry={() => void invites.refetch()} />
          ) : invites.data.items.length ? (
            <ul>
              {invites.data.items.map((invite) => (
                <li className={styles.listRow} key={invite.id}>
                  <div className={styles.body}>
                    <span>팀 초대 링크</span>
                    <span className={styles.meta}>
                      {invite.createdBy} ·{' '}
                      <time dateTime={invite.expiresAt}>{formatDate(invite.expiresAt)}</time>까지
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <InviteLinkActions code={invite.code} />
                    <Button asChild variant="soft">
                      <Link href={`/invite/${invite.code}` as Route}>미리보기</Link>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!editable}
                      onClick={() => action.open(`revoke:${invite.id}`)}
                    >
                      폐기
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="사용할 수 있는 초대 링크가 없어요." />
          )}
        </section>
      )}
      <section className={`${styles.card} ${styles.section}`} aria-labelledby="linked-repos-title">
        <div className={styles.heading}>
          <h2 id="linked-repos-title" className={styles.title}>
            연결된 레포
          </h2>
          {permissions.manageRepos && (
            <Button variant="outline" disabled={!editable} onClick={() => action.open('repos')}>
              레포 관리
            </Button>
          )}
        </div>
        {team.repos.length ? (
          <ul className={styles.list}>
            {team.repos.map((repo) => (
              <li key={repo.id} className={styles.row}>
                <GitBranch size={16} aria-hidden />
                <span>{repo.fullName}</span>
                {repo.private && (
                  <span className={styles.badge}>
                    <LockKeyhole size={16} aria-hidden />
                    비공개
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="연결된 레포가 없어요." />
        )}
      </section>
      <section className={`${styles.card} ${styles.section}`} aria-labelledby="project-board-title">
        <div className={styles.heading}>
          <h2 id="project-board-title" className={styles.title}>
            프로젝트 보드
          </h2>
          {permissions.manageRepos && (
            <Button variant="outline" disabled={!editable} onClick={() => action.open('board')}>
              보드 변경
            </Button>
          )}
        </div>
        <div className={styles.heading}>
          <span className={styles.row}>
            <Settings2 aria-hidden />
            {team.board.name}
          </span>
          <Button variant="soft" onClick={() => external(team.board.url)}>
            GitHub에서 열기
          </Button>
        </div>
      </section>
      <section className={`${styles.card} ${styles.section}`} aria-labelledby="team-plan-title">
        <div className={styles.heading}>
          <h2 id="team-plan-title" className={styles.title}>
            팀 플랜
          </h2>
          <span className={styles.badge}>{team.plan === 'FLEX' ? 'Flex' : 'Free'}</span>
        </div>
        <p>{members.data.count}명이 함께하고 있어요.</p>
        <p className={styles.description}>청구 관리자: {team.billing.managerName}</p>
        {team.plan === 'FLEX' && (
          <p className={styles.description}>
            {team.billing.nextAmount !== null
              ? `다음 결제 금액 ${team.billing.nextAmount.toLocaleString('ko-KR')}원`
              : '다음 결제 금액은 확인 중이에요.'}
            {team.billing.nextBillingAt && ` · ${formatDate(team.billing.nextBillingAt)}`}
          </p>
        )}
        <p className={styles.description}>
          {team.plan === 'FLEX'
            ? '전체 대화 검색, AI 요약과 진행 현황을 이용할 수 있어요.'
            : 'Flex를 구독하면 팀 인원 제한 없이 함께할 수 있어요.'}
        </p>
        <div className={styles.actions}>
          {team.billing.canManage && (
            <Button asChild variant="outline">
              <Link href={teamPlanHref(team.id, team.plan)}>
                {team.plan === 'FLEX' ? '구독 관리' : 'Flex로 올리기'}
              </Link>
            </Button>
          )}
        </div>
        {team.plan === 'FLEX' && (
          <div className={styles.heading}>
            <div>
              <h3 className={styles.cardTitle}>AI 요약</h3>
              <p className={styles.description}>팀 채팅의 대화를 요약해요.</p>
            </div>
            <Button
              variant="soft"
              disabled={team.myRole !== 'OWNER' || !editable}
              aria-pressed={team.aiSummaryEnabled}
              onClick={() => action.open('ai')}
            >
              {team.aiSummaryEnabled ? '사용 중' : '사용 안 함'}
            </Button>
          </div>
        )}
      </section>
      <section
        className={`${styles.card} ${styles.section}`}
        aria-labelledby="team-lifecycle-title"
      >
        <h2 id="team-lifecycle-title" className={styles.title}>
          팀 관리
        </h2>
        <div className={styles.actions}>
          {team.status === 'COMPLETED' && (
            <Button asChild variant="outline">
              <Link href={collaborationLinks.postCreate}>작업물 올리기</Link>
            </Button>
          )}
          {permissions.completeProject && (
            <Button
              variant="outline"
              disabled={!editable}
              onClick={() => action.open(team.status === 'COMPLETED' ? 'completion' : 'complete')}
            >
              {team.status === 'COMPLETED' ? '완료 내역 보기' : '프로젝트 완료'}
            </Button>
          )}
          {permissions.completeProject && team.status === 'COMPLETED' && (
            <>
              {team.completion.canUndo && (
                <Button
                  variant="outline"
                  disabled={!editable}
                  onClick={() => action.open('undo-completion')}
                >
                  완료 취소
                </Button>
              )}
              {team.completion.canRestart && (
                <Button
                  variant="outline"
                  disabled={!editable}
                  onClick={() => action.open('restart')}
                >
                  다시 시작
                </Button>
              )}
            </>
          )}
          {permissions.transferOwnership && (
            <Button variant="outline" disabled={!editable} onClick={() => action.open('transfer')}>
              소유권 이전
            </Button>
          )}
          {permissions.archive && (
            <Button variant="outline" disabled={!editable} onClick={() => action.open('archive')}>
              보관
            </Button>
          )}
          {permissions.deleteTeam && (
            <Button variant="danger" disabled={!editable} onClick={() => action.open('delete')}>
              팀 삭제
            </Button>
          )}
          {permissions.leave && (
            <Button variant="danger" disabled={!editable} onClick={() => action.open('leave')}>
              팀 나가기
            </Button>
          )}
        </div>
        {team.myRole === 'OWNER' && (
          <p className={styles.description}>오너는 먼저 소유권을 넘겨 주세요</p>
        )}
      </section>
      <TeamSettingsActionSheet team={team} members={members.data.items} />
    </div>
  );
}
