'use client';

import { AddBoldIcon } from '@solar-icons/static/bold/add';
import { AltArrowRightLinearIcon } from '@solar-icons/static/linear/alt-arrow-right';
import Image from 'next/image';
import { SlidersHorizontal } from 'lucide-react';

import { ConfirmDialog } from '@/components/overlay/confirm-dialog/ConfirmDialog';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { GitHubMark } from '@/features/github/github-mark/GithubMark';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { TeamSettingsActionSheet } from '../team-settings-action-sheet';
import { ROLES, useTeamSettingsHeaderAction, useTeamSettingsView } from './hook';
import styles from './TeamSettingsView.module.css';

/**
 * Team settings body.
 * Base: Figma 368:387. Owner deltas: Figma 368:1563 (member chevrons, red repo remove, 팀 삭제).
 * Delete confirm modal: Figma 695:1527 / 695:1640 (same chrome as login prompt ConfirmDialog).
 * "팀 나가기" is an explicit extra for members only — owners see 팀 삭제, admins see neither (not on
 * frame 9); its confirm reuses the 팀 삭제 modal.
 */
export function TeamSettingsView({ teamId }: { teamId: string }) {
  const { settings, members, action, team, permissions, editable, copyInvite, linkActions } =
    useTeamSettingsView(teamId);
  const deleteConfirm = useOverlay('team-delete');
  const leaveConfirm = useOverlay('team-leave');

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
  if (!team || !permissions || !members.data) return null;

  const isOwnerView = team.myRole === 'OWNER';
  const memberCountLabel =
    members.data.limit !== null
      ? `${members.data.count}/${members.data.limit}명`
      : `${members.data.count}명`;

  return (
    <div className={styles.page}>
      <section aria-labelledby="team-members-title" className={styles.membersSection}>
        <div className={styles.sectionHead}>
          <h2 id="team-members-title" className={styles.sectionTitle}>
            팀원 프로필
          </h2>
          <p className={styles.sectionMeta}>{memberCountLabel}</p>
        </div>
        <ul className={styles.memberCard}>
          {members.data.items.map((member) => {
            const canManageRow =
              editable &&
              !!member.user.login &&
              permissions.manageMembers &&
              member.role !== 'OWNER' &&
              (isOwnerView || member.role === 'MEMBER');
            return (
              <li key={member.user.id} className={styles.memberRow}>
                {member.user.avatarUrl ? (
                  <Image
                    className={styles.avatar}
                    src={member.user.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    sizes="40px"
                  />
                ) : (
                  <span className={styles.avatar} aria-hidden />
                )}
                <div className={styles.memberText}>
                  <div className={styles.roleRow}>
                    <span className={styles.role}>{ROLES[member.role]}</span>
                    {member.jobLabel ? (
                      <span className={styles.jobLabel}>{member.jobLabel}</span>
                    ) : null}
                  </div>
                  <p className={styles.memberName}>
                    {member.user.name}
                    {member.user.login ? ` @${member.user.login}` : ''}
                  </p>
                </div>
                {canManageRow && (
                  <button
                    type="button"
                    className={styles.memberChevron}
                    aria-label={`${member.user.name} 관리`}
                    onClick={() => action.open(`member:${member.user.id}`)}
                  >
                    <Icon svg={AltArrowRightLinearIcon} className={styles.chevronIcon} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="team-invite-title" className={styles.inviteSection}>
        <h2 id="team-invite-title" className={styles.sectionTitle}>
          팀원 초대하기
        </h2>
        <div className={styles.inviteActions}>
          <button
            type="button"
            className={styles.inviteButton}
            disabled={!editable || !permissions.createInviteLink || copyInvite.isPending}
            onClick={() => copyInvite.mutate()}
          >
            초대 링크 복사
          </button>
          <button
            type="button"
            className={styles.inviteButton}
            disabled={!editable || !permissions.createInviteLink}
            onClick={() => action.open('invite')}
          >
            팀 초대
          </button>
          <button
            type="button"
            className={styles.inviteButton}
            disabled={!editable || team.myRole !== 'OWNER' || !team.githubOrgOwner}
            title={team.githubInvitationBlockedReason ?? undefined}
            onClick={() => action.open('github')}
          >
            Github 조직 초대
          </button>
        </div>
        {linkActions.manualUrl && (
          <div className={styles.manualInvite}>
            <label htmlFor="manual-team-invite" className={styles.manualInviteLabel}>
              복사할 초대 링크
            </label>
            <input
              id="manual-team-invite"
              className={styles.manualInviteInput}
              readOnly
              value={linkActions.manualUrl}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}
        <ul className={styles.inviteHints}>
          <li className={styles.inviteHint}>팀 초대는 Linker 가입자를 팀으로 초대 합니다</li>
          <li className={styles.inviteHint}>
            Github 조직 초대는 조직으로 사용자 초대를 보낼 수 있습니다
          </li>
        </ul>
      </section>

      <div className={styles.band} aria-hidden />

      <section aria-labelledby="team-repos-title" className={styles.reposSection}>
        <div className={styles.reposHead}>
          <div className={styles.reposTitle}>
            <GitHubMark className={styles.githubMark} width={22} height={22} />
            <h2 id="team-repos-title" className={styles.reposLabel}>
              GitHub 저장소
            </h2>
            <span className={styles.reposCount}>{team.repos.length}개 연결 됨</span>
          </div>
          <button
            type="button"
            className={styles.addRepo}
            aria-label="저장소 추가"
            disabled={!editable || !permissions.manageRepos}
            onClick={() => action.open('repos')}
          >
            <Icon svg={AddBoldIcon} className={styles.addIcon} />
          </button>
        </div>
        <ul className={styles.repoList}>
          {team.repos.map((repo) => (
            <li key={repo.id} className={styles.repoRow}>
              <span className={styles.repoName}>{repo.name}</span>
              <button
                type="button"
                className={`${styles.removeRepo}${isOwnerView ? ` ${styles.removeRepoOwner}` : ''}`}
                aria-label={`${repo.name} 연결 해제`}
                disabled={!editable || !permissions.manageRepos}
                onClick={() => action.open(`remove-repo:${repo.id}`)}
              >
                <span className={styles.removeMark} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {isOwnerView ? (
        <div className={styles.deleteWrap}>
          <button
            type="button"
            className={styles.delete}
            disabled={!editable || !permissions.deleteTeam}
            onClick={() => deleteConfirm.open()}
          >
            팀 삭제
          </button>
        </div>
      ) : team.myRole === 'MEMBER' && permissions.leave ? (
        <div className={styles.leaveWrap}>
          <button
            type="button"
            className={styles.leave}
            disabled={!editable}
            onClick={() => leaveConfirm.open()}
          >
            팀 나가기
          </button>
        </div>
      ) : null}

      <TeamSettingsActionSheet team={team} members={members.data.items} />
      {/* Figma 695:1640 — markup only; delete API/policy later */}
      <ConfirmDialog
        overlay={deleteConfirm}
        title="팀 삭제"
        description="해당 팀을 삭제하시겠습니까? 한번 팀을 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?"
        confirmLabel="삭제하기"
        onConfirm={() => deleteConfirm.close()}
      />
      {/* Same modal as 팀 삭제 — markup only; leave API/policy later */}
      <ConfirmDialog
        overlay={leaveConfirm}
        title="팀 나가기"
        description="팀을 나가고 다시 들어오실려면 오너의 승인이 필요 합니다. 나가시겠습니까?"
        confirmLabel="팀 나가기"
        onConfirm={() => leaveConfirm.close()}
      />
    </div>
  );
}

/** Existing settings header icon opens the existing information editor. */
export function TeamSettingsHeaderAction({ teamId }: { teamId: string }) {
  const { action, canEdit } = useTeamSettingsHeaderAction(teamId);
  return (
    <button
      type="button"
      className={styles.headerIcon}
      aria-label="팀 정보 편집"
      disabled={!canEdit}
      onClick={() => action.open('info')}
    >
      <SlidersHorizontal aria-hidden />
    </button>
  );
}
