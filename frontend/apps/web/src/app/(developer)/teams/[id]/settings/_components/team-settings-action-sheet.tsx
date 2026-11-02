'use client';

// overlay: team action forms are previews only; no mutation is sent
import { useQuery } from '@tanstack/react-query';
import { OverlaySheet } from '@/components/overlay/overlay-sheet';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import styles from '@/features/teams/team-ui.module.css';
import { formatDate } from '@/lib/format/time';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { TEAM } from '@/lib/policy';
import { useViewer } from '@/lib/auth/viewer-context';
import { TeamRepoSelection } from '../../../_components/team-repo-selection';
import { TeamBoardSelection } from '../../../_components/team-board-selection';
import { setupBoardsOptions } from '../../../_lib/setup-queries';

import type { Members, TeamSettings } from '../_lib/settings-queries';

const TITLES: Record<string, string> = {
  info: '팀 정보 편집',
  invite: '초대 링크 만들기',
  member: '멤버 관리',
  revoke: '초대 링크를 폐기할까요?',
  repos: '연결 레포 관리',
  board: '보드 변경',
  transfer: '소유권 이전',
  complete: '프로젝트를 완료할까요?',
  completion: '프로젝트 완료 내역',
  archive: '팀을 보관할까요?',
  delete: '팀을 삭제할까요?',
  leave: '팀을 나갈까요?',
  remove: '팀에서 내보낼까요?',
  role: '팀 역할을 변경할까요?',
  github: 'GitHub 조직 초대',
  'accept-transfer': '소유권 이전을 수락할까요?',
  claim: '소유권 인수 안내',
  'undo-completion': '프로젝트 완료를 취소할까요?',
  restart: '프로젝트를 다시 시작할까요?',
  ai: 'AI 요약 설정',
};

export function TeamSettingsActionSheet({
  team,
  members,
}: {
  team: TeamSettings;
  members: Members['items'];
}) {
  const overlay = useOverlay('team-settings-action');
  const [kind = '', target] = (overlay.id ?? '').split(':');
  const member = members.find((item) => String(item.user.id) === target);
  const viewer = useViewer();
  const boards = useQuery({
    ...setupBoardsOptions(String(team.id)),
    enabled:
      overlay.isOpen &&
      kind === 'board' &&
      team.permissions.manageRepos &&
      viewer.status !== 'SUSPENDED' &&
      !['READ_ONLY', 'ARCHIVED'].includes(team.status),
  });
  const [selectedRepos, setSelectedRepos] = useState(team.repos.map((repo) => repo.id));
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const canManageMember =
    member &&
    member.role !== 'OWNER' &&
    team.permissions.manageMembers &&
    (team.myRole === 'OWNER' || member.role === 'MEMBER');
  const p = team.permissions;
  const allowed: Record<string, boolean> = {
    info: p.editInfo,
    invite: p.createInviteLink,
    revoke: p.createInviteLink,
    member: !!canManageMember,
    remove: !!canManageMember,
    role: p.changeRoles && !!canManageMember,
    repos: p.manageRepos,
    board: p.manageRepos,
    transfer: p.transferOwnership,
    'accept-transfer': !!team.ownershipTransfer?.isRecipient,
    claim: !!team.ownershipClaim?.eligible,
    complete: p.completeProject && team.status === 'ACTIVE',
    completion: p.completeProject,
    'undo-completion': p.completeProject && team.completion.canUndo,
    restart: p.completeProject && team.completion.canRestart,
    archive: p.archive,
    delete: p.deleteTeam,
    leave: p.leave,
    ai: team.myRole === 'OWNER' && team.plan === 'FLEX',
  };
  if (
    overlay.isOpen &&
    (!allowed[kind] ||
      (kind !== 'completion' &&
        (viewer.status === 'SUSPENDED' || ['READ_ONLY', 'ARCHIVED'].includes(team.status))))
  )
    return (
      <OverlaySheet overlay={overlay} title="팀 설정" description="이 작업을 할 수 없어요.">
        <p className={styles.description}>현재 역할이나 팀 상태에서는 변경할 수 없어요.</p>
        <Button variant="outline" onClick={overlay.close}>
          닫기
        </Button>
      </OverlaySheet>
    );
  return (
    <OverlaySheet
      overlay={overlay}
      title={TITLES[kind] ?? '팀 설정'}
      description="입력 화면을 미리 볼 수 있어요. 변경 내용은 아직 저장되지 않아요."
    >
      <div className={styles.stack}>
        {kind === 'info' && (
          <>
            <div className={styles.field}>
              <label htmlFor="edit-team-name">팀 이름</label>
              <input id="edit-team-name" className={styles.input} defaultValue={team.name} />
            </div>
            <div className={styles.field}>
              <label htmlFor="edit-team-intro">팀 소개</label>
              <textarea
                id="edit-team-intro"
                className={styles.textarea}
                defaultValue={team.description}
              />
            </div>
          </>
        )}
        {kind === 'invite' && (
          <p>
            초대 링크는 {TEAM.inviteValidDays}일 동안 사용할 수 있어요. 링크를 받은 개발자는 팀에
            참여하고 팀 채팅을 이용할 수 있어요.
          </p>
        )}
        {kind === 'revoke' && (
          <p>이 링크로는 더 이상 팀에 참여할 수 없어요. 이미 참여한 멤버는 팀에 남아 있어요.</p>
        )}
        {kind === 'member' && member && (
          <>
            <p>
              {member.user.name} · @{member.user.login}
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
              {member.inGithubOrg
                ? 'GitHub 조직에 참여한 멤버예요.'
                : 'GitHub 조직 초대를 수락해야 이슈 담당자가 될 수 있어요.'}
            </p>
            <Button variant="outline" disabled>
              GitHub 조직 초대
            </Button>
            <p className={styles.description}>
              {team.githubInvitationBlockedReason ??
                (team.githubOrgOwner
                  ? 'GitHub 조직 초대는 아직 전송되지 않아요.'
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
            <TeamRepoSelection
              repos={team.availableRepos}
              selected={selectedRepos}
              onChange={setSelectedRepos}
            />
            <p className={styles.description}>
              선택을 해제하면 연결에서 제외돼요. GitHub의 레포와 이슈는 삭제되지 않아요. 변경 내용은
              저장되지 않아요.
            </p>
          </div>
        )}
        {kind === 'board' && (
          <>
            <p>현재 보드: {team.board.name}</p>
            {boards.isPending ? (
              <LoadingIndicator label="불러오는 중…" labelHidden variant="block">
                <Skeleton />
              </LoadingIndicator>
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
            오너는 소유권 이전으로만 바꿀 수 있어요. 변경 내용은 아직 적용되지 않아요.
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
              {team.completion.finalized
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
                autoComplete="off"
              />
            </div>
          </>
        )}
        {kind === 'leave' && (
          <p>팀을 나가면 새로운 채팅을 볼 수 없어요. 팀에 남은 메시지는 삭제되지 않아요.</p>
        )}
        <p className={styles.description}>저장·초대·삭제 기능은 준비 중이에요.</p>
        <div className={styles.actions}>
          <Button variant="outline" onClick={overlay.close}>
            닫기
          </Button>
          {!['completion', 'claim'].includes(kind) && (
            <Button disabled>
              {['delete', 'leave', 'archive', 'revoke'].includes(kind)
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
                              : kind === 'invite'
                                ? '초대 링크 만들기'
                                : '저장'}
            </Button>
          )}
        </div>
      </div>
    </OverlaySheet>
  );
}
