'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { invitesOptions, membersOptions, settingsOptions } from './api';
import { getOrCreateTeamInvite } from '../../_lib/settings-queries';
import { useInviteLinkActions } from '../invite-link-actions/hook';
import { toast } from '@/stores/toast-store';

export const ROLES = { OWNER: '오너', ADMIN: '관리자', MEMBER: '멤버' } as const;
export const ORG_STATUS = {
  MEMBER: 'GitHub 조직 멤버',
  INVITED: 'GitHub 조직 초대 중',
  NOT_MEMBER: 'GitHub 조직 미가입',
} as const;

export function useTeamSettingsView(teamId: string) {
  const settings = useQuery(settingsOptions(teamId));
  const members = useQuery(membersOptions(teamId));
  const viewer = useViewer();
  const canManage = settings.data?.myRole !== 'MEMBER' && !!settings.data;
  // Invite-link list is unused until a revoke/list UI ships; keep the option for that handoff.
  const invites = useQuery({
    ...invitesOptions(teamId),
    enabled: false,
  });
  const action = useOverlay('team-settings-action');
  const external = useOpenExternal();

  const linkActions = useInviteLinkActions('');
  const client = useQueryClient();
  const copyInvite = useMutation({
    mutationFn: async () => {
      // Start create/fetch and clipboard in the same click turn. Awaiting the
      // network first drops user activation and makes navigator.clipboard fail.
      const href = getOrCreateTeamInvite(client, teamId, viewer.login).then((link) =>
        linkActions.inviteUrl(link.code),
      );
      return linkActions.copyDeferred(href);
    },
    onSuccess: (copied) => {
      toast(
        copied
          ? '초대 링크를 복사했어요.'
          : '자동으로 복사하지 못했어요. 아래 링크를 선택해 복사해 주세요.',
      );
    },
    onError: (error) => toast(error.message, { tone: 'error' }),
  });
  const team = settings.data;
  const editable =
    !!team && viewer.status !== 'SUSPENDED' && !['READ_ONLY', 'ARCHIVED'].includes(team.status);

  return {
    settings,
    copyInvite,
    linkActions,
    members,
    invites,
    canManage,
    action,
    external,
    team,
    editable,
    permissions: team?.permissions,
  };
}

export function useTeamSettingsHeaderAction(teamId: string) {
  const { data: team } = useQuery(settingsOptions(teamId));
  const viewer = useViewer();
  const action = useOverlay('team-settings-action');
  const canEdit =
    !!team?.permissions.editInfo &&
    viewer.status !== 'SUSPENDED' &&
    !['READ_ONLY', 'ARCHIVED'].includes(team.status);
  return { action, canEdit };
}
