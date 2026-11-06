'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { setupBoardsOptions, type Members, type TeamSettings } from './api';

export const TITLES: Record<string, string> = {
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

export function useTeamSettingsActionSheet({
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

  const denied =
    overlay.isOpen &&
    (!allowed[kind] ||
      (kind !== 'completion' &&
        (viewer.status === 'SUSPENDED' || ['READ_ONLY', 'ARCHIVED'].includes(team.status))));

  return {
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
  };
}
