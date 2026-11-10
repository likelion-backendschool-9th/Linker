'use client';

import { OverlaySheet } from '@/components/overlay/overlay-sheet/OverlaySheet';
import { Button } from '@/components/ui/button/Button';
import { ErrorState } from '@/components/ui/error-state/ErrorState';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import styles from '@/features/teams/team-ui.module.css';
import { formatDate } from '@/lib/format/time';
import { TEAM } from '@/lib/policy';
import { TeamRepoSelection } from '../../../../_components/team-repo-selection';
import { TeamBoardSelection } from '../../../../_components/team-board-selection';

import type { Members, TeamSettings } from './api';
import { TITLES, useTeamSettingsActionSheet } from './hook';
import inviteStyles from './TeamSettingsActionSheet.module.css';

export function TeamSettingsActionSheet({
  team,
  members,
}: {
  team: TeamSettings;
  members: Members['items'];
}) {
  const {
    handle,
    setInviteHandle,
    mutation,
    supported,
    canSubmit,
    name,
    setName,
    description,
    setDescription,
    confirmName,
    setConfirmName,
    repoCandidates,
    overlay,
    kind,
    target,
    member,
    boards,
    selectedRepos,
    setSelectedRepos,
    roleDrafts,
    setRoleDrafts,
    canManageMember,
    denied,
  } = useTeamSettingsActionSheet({ team, members });
  if (denied)
    return (
      <OverlaySheet overlay={overlay} title="팀 설정" description="이 작업을 할 수 없어요.">
        <p className={styles.description}>현재 역할이나 팀 상태에서는 변경할 수 없어요.</p>
        <Button variant="outline" onClick={overlay.close}>
          닫기
        </Button>
      </OverlaySheet>
    );

  /* Figma 368:1397 — team invite by Linker handle */
  if (kind === 'invite') {
    return (
      <OverlaySheet
        overlay={overlay}
        title="팀 초대"
        description="Linker 가입자를 팀으로 초대합니다."
        describeHidden
        classNames={{
          sheet: inviteStyles.inviteSheet,
          header: inviteStyles.inviteHeader,
          title: inviteStyles.inviteTitle,
          close: inviteStyles.inviteClose,
          body: inviteStyles.inviteBody,
        }}
      >
        <form
          className={inviteStyles.inviteStack}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (canSubmit) mutation.mutate(overlay.id ?? '');
          }}
        >
          <div className={inviteStyles.inviteField}>
            <label className="sr-only" htmlFor="team-invite-handle">
              GitHub 로그인
            </label>
            <input
              id="team-invite-handle"
              className={inviteStyles.inviteInput}
              type="text"
              placeholder="@JUNHORANG"
              value={handle}
              aria-invalid={mutation.isError && mutation.variables === overlay.id}
              aria-describedby={
                mutation.isError && mutation.variables === overlay.id
                  ? `${kind}-invite-error`
                  : undefined
              }
              disabled={mutation.isPending}
              onChange={(event) => {
                setInviteHandle(event.target.value);
                if (mutation.isError) mutation.reset();
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <p className={inviteStyles.inviteHint}>팀 초대는 Linker 가입자를 팀으로 초대 합니다</p>
          </div>
          {mutation.isError && mutation.variables === overlay.id && (
            <p id={`${kind}-invite-error`} role="alert">
              {mutation.error.message}
            </p>
          )}
          <button type="submit" className={inviteStyles.inviteSubmit} disabled={!canSubmit}>
            초대
          </button>
        </form>
      </OverlaySheet>
    );
  }

  /* Figma 368:1544 — GitHub org invite (same chrome as team invite; title differs) */
  if (kind === 'github') {
    return (
      <OverlaySheet
        overlay={overlay}
        title="GitHub 조직 초대"
        description="GitHub 조직으로 사용자 초대를 보냅니다."
        describeHidden
        classNames={{
          sheet: inviteStyles.inviteSheet,
          header: inviteStyles.inviteHeader,
          title: inviteStyles.inviteTitle,
          close: inviteStyles.inviteClose,
          body: inviteStyles.inviteBody,
        }}
      >
        <form
          className={inviteStyles.inviteStack}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (canSubmit) mutation.mutate(overlay.id ?? '');
          }}
        >
          <div className={inviteStyles.inviteField}>
            <label className="sr-only" htmlFor="github-org-invite-handle">
              GitHub 로그인
            </label>
            <input
              id="github-org-invite-handle"
              className={inviteStyles.inviteInput}
              type="text"
              placeholder="@JUNHORANG"
              value={handle}
              aria-invalid={mutation.isError && mutation.variables === overlay.id}
              aria-describedby={
                mutation.isError && mutation.variables === overlay.id
                  ? `${kind}-invite-error`
                  : undefined
              }
              disabled={mutation.isPending}
              onChange={(event) => {
                setInviteHandle(event.target.value);
                if (mutation.isError) mutation.reset();
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <p className={inviteStyles.inviteHint}>
              Github 조직 초대는 조직으로 사용자 초대를 보낼 수 있습니다
            </p>
          </div>
          {mutation.isError && mutation.variables === overlay.id && (
            <p id={`${kind}-invite-error`} role="alert">
              {mutation.error.message}
            </p>
          )}
          <button type="submit" className={inviteStyles.inviteSubmit} disabled={!canSubmit}>
            초대
          </button>
        </form>
      </OverlaySheet>
    );
  }

  return (
    <OverlaySheet
      overlay={overlay}
      title={TITLES[kind] ?? '팀 설정'}
      describeHidden={supported}
      description={
        supported
          ? (TITLES[kind] ?? '팀 설정')
          : '입력 화면을 미리 볼 수 있어요. 변경 내용은 아직 저장되지 않아요.'
      }
    >
      <div className={styles.stack}>
        {kind === 'info' && (
          <>
            <div className={styles.field}>
              <label htmlFor="edit-team-name">팀 이름</label>
              <input
                id="edit-team-name"
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="edit-team-intro">팀 소개</label>
              <textarea
                id="edit-team-intro"
                className={styles.textarea}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </>
        )}
        {kind === 'revoke' && (
          <p>이 링크로는 더 이상 팀에 참여할 수 없어요. 이미 참여한 멤버는 팀에 남아 있어요.</p>
        )}
        {kind === 'member' && member && (
          <>
            <p>
              {member.user.name}
              {member.user.login ? ` · @${member.user.login}` : ''}
            </p>
            <div className={styles.field}>
              <label htmlFor="member-role">팀 역할</label>
              <select
                id="member-role"
                className={styles.select}
                value={roleDrafts[target!] ?? member.role}
                onChange={(event) =>
                  setRoleDrafts((drafts) => ({ ...drafts, [target!]: event.target.value }))
                }
                disabled={!team.permissions.changeRoles}
              >
                <option value="ADMIN">관리자</option>
                <option value="MEMBER">멤버</option>
              </select>
            </div>
            <p className={styles.description}>
              {member.githubOrgStatus === 'MEMBER'
                ? 'GitHub 조직에 참여한 멤버예요.'
                : member.githubOrgStatus === 'INVITED'
                  ? 'GitHub 조직 초대가 진행 중이에요. 수락해야 이슈 담당자가 될 수 있어요.'
                  : 'GitHub 조직 초대를 수락해야 이슈 담당자가 될 수 있어요.'}
            </p>
            <Button
              variant="outline"
              disabled={
                team.myRole !== 'OWNER' ||
                !team.githubOrgOwner ||
                member.githubOrgStatus !== 'NOT_MEMBER'
              }
              onClick={() => overlay.open(`github:${target}`)}
            >
              GitHub 조직 초대
            </Button>
            <p className={styles.description}>
              {team.githubInvitationBlockedReason ??
                (team.githubOrgOwner
                  ? member.githubOrgStatus === 'INVITED'
                    ? 'GitHub 조직 초대가 이미 진행 중이에요.'
                    : member.githubOrgStatus === 'MEMBER'
                      ? '이미 GitHub 조직에 참여한 멤버예요.'
                      : 'GitHub 조직 초대는 아직 전송되지 않아요.'
                  : 'GitHub 조직 오너만 조직에 초대할 수 있어요.')}
            </p>
            {team.permissions.changeRoles && (
              <Button variant="outline" onClick={() => overlay.open(`role:${target}`)}>
                역할 변경 확인
              </Button>
            )}
            {canManageMember && (
              <Button variant="danger" onClick={() => overlay.open(`remove:${target}`)}>
                팀에서 내보내기
              </Button>
            )}
            <p className={styles.description}>
              Linker에서 내보내도 GitHub 조직에서는 제거되지 않아요.
            </p>
          </>
        )}
        {kind === 'repos' && (
          <div className={styles.section}>
            {repoCandidates.isPending ? (
              <Skeleton />
            ) : repoCandidates.isError ? (
              <ErrorState onRetry={() => void repoCandidates.refetch()} />
            ) : (
              <TeamRepoSelection
                repos={repoCandidates.data.items}
                selected={selectedRepos}
                onChange={setSelectedRepos}
              />
            )}
            <p className={styles.description}>
              선택을 해제하면 연결에서 제외돼요. GitHub의 레포와 이슈는 삭제되지 않아요.
            </p>
          </div>
        )}
        {kind === 'board' && (
          <>
            <p>현재 보드: {team.board?.name ?? '—'}</p>
            {boards.isPending ? (
              <Skeleton />
            ) : boards.isError ? (
              <ErrorState onRetry={() => void boards.refetch()} />
            ) : (
              <TeamBoardSelection boards={boards.data.items} />
            )}
            <p className={styles.description}>
              보드를 바꾸면 팀 이슈의 일정과 상태를 다시 불러와요.
            </p>
          </>
        )}
        {kind === 'transfer' && (
          <>
            <div className={styles.field}>
              <label htmlFor="new-team-owner">새 오너</label>
              <select id="new-team-owner" className={styles.select} defaultValue="">
                <option value="" disabled>
                  멤버를 선택해 주세요
                </option>
                {members
                  .filter((m) => m.role !== 'OWNER')
                  .map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name} (@{m.user.login})
                    </option>
                  ))}
              </select>
            </div>
            <p className={styles.description}>
              상대가 수락하면 소유권이 이전돼요. 기존 오너는 관리자가 되고 청구 관리자는 유지돼요.
            </p>
          </>
        )}
        {kind === 'complete' && (
          <p>
            팀원에게 작업물을 올릴 수 있도록 알려요. 프로젝트를 완료해도 채팅과 이슈는 계속 사용할
            수 있어요.
          </p>
        )}
        {kind === 'role' && member && (
          <p>
            {member.user.name}님의 역할을{' '}
            {(roleDrafts[target!] ?? member.role) === 'ADMIN' ? '관리자' : '멤버'}로 변경해요.
            오너는 소유권 이전으로만 바꿀 수 있어요.
          </p>
        )}
        {kind === 'remove' && member && (
          <>
            <p>{member.user.name}님을 팀에서 내보내면 새로운 팀 채팅과 이슈에 접근할 수 없어요.</p>
            <p className={styles.description}>
              기존 메시지는 남고 GitHub 조직에서는 제거되지 않아요. {TEAM.removedApplyBlockedDays}일
              동안 이 팀 모집 글에 지원할 수 없어요.
            </p>
          </>
        )}
        {kind === 'accept-transfer' && team.ownershipTransfer?.isRecipient && (
          <>
            <p>
              {team.ownershipTransfer.fromName}님이 보낸 소유권 이전 요청이에요. 수락하면 내가
              오너가 되고 이전 오너는 관리자가 돼요.
            </p>
            <p className={styles.description}>
              청구 관리자는 바뀌지 않아요. 수락 기능은 아직 실행되지 않아요.
            </p>
          </>
        )}
        {kind === 'claim' && (
          <p>
            {team.ownershipClaim?.reason ?? '서버에서 소유권 인수 대상인지 확인해야 해요.'} 오너의
            영구 정지 또는 장기 부재에 따른 인수는 서버의 권한 확인 후 가능해요.
          </p>
        )}
        {kind === 'undo-completion' && (
          <p>
            완료 후 {TEAM.completionUndoDays}일 이내에만 취소할 수 있어요. 완료 상태와 아직 확정되지
            않은 완주 기록을 되돌려요.
          </p>
        )}
        {kind === 'restart' && (
          <p>
            프로젝트를 다시 활동 중으로 바꿔요. 이미 확정된 완주 기록은 유지돼요. 다시 시작 기능은
            아직 실행되지 않아요.
          </p>
        )}
        {kind === 'ai' && (
          <>
            <label className={styles.choice}>
              <input type="checkbox" defaultChecked={team.aiSummaryEnabled} />
              AI 요약 사용
            </label>
            <p className={styles.description}>
              Flex 팀의 오너만 설정할 수 있어요. 입력 내용을 바꿔도 실제 설정은 저장되지 않아요.
            </p>
          </>
        )}
        {kind === 'completion' && (
          <>
            <p>
              완료일: {team.completedAt ? formatDate(team.completedAt) : '완료일을 확인하고 있어요'}
            </p>
            <p className={styles.description}>
              {team.completion?.finalized
                ? '완주 기록이 확정됐어요.'
                : `완료 후 ${TEAM.completionUndoDays}일이 지나면 완주 기록이 확정돼요.`}{' '}
              완료 시점에 팀에 있고 소속 기간이 {TEAM.completionMembershipDays}일 이상인 멤버의
              기록은 서버에서 계산해요. 프로젝트를 다시 시작해도 확정된 완주 기록은 유지돼요.
            </p>
          </>
        )}
        {kind === 'archive' && (
          <p>보관된 팀에서 채팅 기록을 읽을 수 있어요. 참여 중인 팀 수에는 포함되지 않아요.</p>
        )}
        {kind === 'delete' && (
          <>
            <p className={styles.danger}>
              팀 삭제는 되돌릴 수 없어요. GitHub 조직과 이슈는 삭제되지 않아요.
            </p>
            <p className={styles.description}>
              팀원에게 알리고 채팅 기록은 {TEAM.chatDeletionDays}일 뒤 삭제돼요.
            </p>
            <div className={styles.field}>
              <label htmlFor="delete-team-name">확인을 위해 팀 이름을 입력해 주세요</label>
              <input
                id="delete-team-name"
                className={styles.input}
                placeholder={team.name}
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                autoComplete="off"
              />
            </div>
          </>
        )}
        {kind === 'remove-repo' && <p>GitHub의 레포와 이슈는 삭제되지 않아요.</p>}
        {kind === 'leave' && (
          <p>팀을 나가면 새로운 채팅을 볼 수 없어요. 팀에 남은 메시지는 삭제되지 않아요.</p>
        )}
        {!supported && <p className={styles.description}>저장·초대·삭제 기능은 준비 중이에요.</p>}
        {mutation.isError && mutation.variables === overlay.id && (
          <p role="alert" className={styles.danger}>
            {mutation.error.message}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="outline" onClick={overlay.close}>
            닫기
          </Button>
          {!['completion', 'claim'].includes(kind) && (
            <Button disabled={!canSubmit} onClick={() => mutation.mutate(overlay.id ?? '')}>
              {['delete', 'leave', 'archive', 'revoke', 'remove-repo'].includes(kind)
                ? '확인'
                : kind === 'accept-transfer'
                  ? '소유권 이전 수락'
                  : kind === 'undo-completion'
                    ? '완료 취소'
                    : kind === 'restart'
                      ? '다시 시작'
                      : kind === 'remove'
                        ? '팀에서 내보내기'
                        : kind === 'role'
                          ? '역할 변경'
                          : kind === 'complete'
                            ? '프로젝트 완료'
                            : kind === 'transfer'
                              ? '이전 요청 보내기'
                              : '저장'}
            </Button>
          )}
        </div>
      </div>
    </OverlaySheet>
  );
}
