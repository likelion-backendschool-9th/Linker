'use client';

import { useQuery } from '@tanstack/react-query';

import { useOpenExternal } from '@/features/external-link/use-open-external';
import { useViewer } from '@/lib/auth/viewer-context';
import { useOverlay } from '@/lib/navigation/use-overlay';

import { invitesOptions, membersOptions, settingsOptions } from './api';

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
  const invites = useQuery({ ...invitesOptions(teamId), enabled: canManage });
  const action = useOverlay('team-settings-action');
  const external = useOpenExternal();

  const team = settings.data;
  const editable =
    !!team &&
    viewer.status !== 'SUSPENDED' &&
    !['READ_ONLY', 'ARCHIVED'].includes(team.status);

  return {
    settings,
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
