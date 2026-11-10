'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { toast } from '@/stores/toast-store';

import {
  updateTeamInfo,
  deleteTeam,
  leaveTeam,
  archiveTeam,
  removeTeamMember,
  changeTeamMemberRole,
  removeTeamRepository,
  addTeamRepository,
  getOrCreateTeamInvite,
  notifyTeamInvite,
  inviteGithubMember,
  setupBoardsOptions,
  setupReposOptions,
  type Members,
  type TeamSettings,
} from './api';

export const TITLES: Record<string, string> = {
  info: '팀 정보 편집',
  invite: '팀 초대',
  member: '멤버 관리',
  revoke: '초대 링크를 폐기할까요?',
  repos: '연결 레포 관리',
  'remove-repo': '저장소 연결을 해제할까요?',
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
  const repoCandidates = useQuery({
    ...setupReposOptions(String(team.id)),
    enabled:
      overlay.isOpen &&
      kind === 'repos' &&
      team.permissions.manageRepos &&
      viewer.status !== 'SUSPENDED' &&
      !['READ_ONLY', 'ARCHIVED'].includes(team.status),
  });
  const [selectedRepos, setSelectedRepos] = useState<number[] | null>(null);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [confirmName, setConfirmName] = useState('');
  const [inviteHandle, setInviteHandle] = useState<string | null>(null);
  const handle =
    inviteHandle ?? (kind === 'github' ? (member?.githubLogin ?? member?.user.login ?? '') : '');
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
    github: team.myRole === 'OWNER' && !!team.githubOrgOwner,
    revoke: p.createInviteLink,
    member: !!canManageMember,
    remove: !!canManageMember,
    role: p.changeRoles && !!canManageMember,
    repos: p.manageRepos,
    'remove-repo': p.manageRepos && team.repos.some((repo) => String(repo.id) === target),
    board: p.manageRepos,
    transfer: p.transferOwnership,
    'accept-transfer': !!team.ownershipTransfer?.isRecipient,
    claim: !!team.ownershipClaim?.eligible,
    complete: p.completeProject && team.status === 'ACTIVE',
    completion: p.completeProject,
    'undo-completion': p.completeProject && !!team.completion?.canUndo,
    restart: p.completeProject && !!team.completion?.canRestart,
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

  const client = useQueryClient();
  const supported = [
    'invite',
    'github',
    'info',
    'role',
    'remove',
    'leave',
    'archive',
    'delete',
    'repos',
    'remove-repo',
  ].includes(kind);
  const connected = team.repos.map((repo) => repo.githubRepoId ?? repo.id);
  const selection = selectedRepos ?? connected;
  const mutation = useMutation({
    mutationKey: ['team-settings-change', team.id, kind, target],
    mutationFn: async (requestId: string) => {
      if (requestId !== overlay.id || denied || !supported)
        throw new Error('이 작업을 할 수 없어요.');
      if (kind === 'invite') {
        const link = await getOrCreateTeamInvite(client, team.id, viewer.login);
        return notifyTeamInvite(team.id, link, handle.trim().replace(/^@/, ''));
      }
      if (kind === 'github') {
        const targetMember = members.find(
          (item) =>
            (item.githubLogin ?? item.user.login ?? '').toLowerCase() ===
            handle.trim().replace(/^@/, '').toLowerCase(),
        );
        if (!targetMember) throw new Error('현재 팀원의 GitHub 로그인을 입력해 주세요.');
        return inviteGithubMember(team.id, targetMember.user.id);
      }
      if (kind === 'info') return updateTeamInfo(team.id, { name: name.trim(), description });
      if (kind === 'delete') return deleteTeam(team.id, { confirmName });
      if (kind === 'leave') return leaveTeam(team.id);
      if (kind === 'archive') return archiveTeam(team.id);
      if (kind === 'remove') return removeTeamMember(team.id, Number(target));
      if (kind === 'role' && member) {
        const role = roleDrafts[target!] ?? member.role;
        if (role !== 'ADMIN' && role !== 'MEMBER') throw new Error('팀 역할을 확인해 주세요.');
        return changeTeamMemberRole(team.id, Number(target), { role });
      }
      if (kind === 'remove-repo') return removeTeamRepository(team.id, Number(target));
      if (kind === 'repos') {
        // The setup list exposes GitHub IDs; disconnect requires Linker's cached repository ID.
        const candidates = repoCandidates.data?.items;
        if (!candidates) throw new Error('저장소 목록을 다시 확인해 주세요.');
        for (const repoId of selection.filter((id) => !connected.includes(id))) {
          if (!candidates.some((repo) => repo.id === repoId))
            throw new Error('저장소 목록을 다시 확인해 주세요.');
          await addTeamRepository(team.id, { repoId });
        }
        for (const repo of team.repos.filter(
          (repo) => !selection.includes(repo.githubRepoId ?? repo.id),
        )) {
          await removeTeamRepository(team.id, repo.id);
        }
      }
    },
    onSuccess: async (data, requestId) => {
      if (requestId.split(':')[0] === 'invite') {
        client.removeQueries({
          queryKey: ['team-settings', String(team.id), 'created-invite', viewer.login],
          exact: true,
        });
        toast('팀 초대를 보냈어요.');
      }
      if (requestId.split(':')[0] === 'github')
        toast(
          data && data.status === 'MEMBER'
            ? '이미 GitHub 조직에 참여한 팀원이에요.'
            : data && !data.sent
              ? 'GitHub 조직 초대가 이미 진행 중이에요.'
              : 'GitHub 조직 초대를 보냈어요.',
        );
      setInviteHandle(null);
      setSelectedRepos(null);
      setConfirmName('');
      if (['leave', 'archive', 'delete'].includes(requestId.split(':')[0]!))
        await overlay.closeThen('/workspace');
      else if (overlay.id === requestId) overlay.close();
    },
    // A multi-repository update can partially succeed: refetch authoritative state even on error.
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['team-settings', String(team.id)] }),
        client.invalidateQueries({ queryKey: ['teams', 'mine'] }),
        client.invalidateQueries({ queryKey: ['chat'] }),
        client.invalidateQueries({ queryKey: ['team-setup', String(team.id), 'repos'] }),
      ]);
    },
  });
  // Focus after React reenables the input; the mutation callback runs while it is disabled.
  useEffect(() => {
    if (
      mutation.isError &&
      mutation.variables === overlay.id &&
      overlay.isOpen &&
      (kind === 'invite' || kind === 'github')
    ) {
      document
        .getElementById(kind === 'invite' ? 'team-invite-handle' : 'github-org-invite-handle')
        ?.focus();
    }
  }, [mutation.isError, mutation.variables, overlay.id, overlay.isOpen, kind]);
  const canSubmit =
    supported &&
    !denied &&
    !mutation.isPending &&
    (!['invite', 'github'].includes(kind) || !!handle.trim().replace(/^@/, '')) &&
    (kind !== 'delete' || confirmName === team.name) &&
    (kind !== 'info' || !!name.trim()) &&
    (kind !== 'repos' || repoCandidates.isSuccess);

  return {
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
    selectedRepos: selection,
    setSelectedRepos,
    roleDrafts,
    setRoleDrafts,
    canManageMember,
    denied,
  };
}
