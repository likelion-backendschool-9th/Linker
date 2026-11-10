import { queryOptions, type QueryClient } from '@tanstack/react-query';

import {
  getTeamSettings,
  getTeamMembers,
  listTeamInviteLinks,
  createTeamInviteLink,
  notifyTeamInvite as sendTeamInvite,
  inviteGithubOrganizationMember,
} from '@linker/api/team-invitations/p09-team-settings/p09-team-settings';
import type {
  CreatedTeamInvite,
  TeamSettingsMembers,
} from '@linker/api/team-invitations/openAPIDefinition.schemas';

/** Server contracts; optional fields belong to the deferred ownership/completion UI. */
export type TeamSettings = {
  id: number;
  name: string;
  description: string | null;
  orgLogin: string;
  orgAvatarUrl: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'READ_ONLY' | 'ARCHIVED';
  plan: 'FREE' | 'FLEX';
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  permissions: Record<
    | 'editInfo'
    | 'manageRepos'
    | 'createInviteLink'
    | 'manageMembers'
    | 'changeRoles'
    | 'transferOwnership'
    | 'completeProject'
    | 'archive'
    | 'deleteTeam'
    | 'leave',
    boolean
  >;
  repos: { id: number; githubRepoId?: number; name: string; fullName: string; private?: boolean }[];
  board: { id: string | number; name: string; url: string } | null;
  aiSummaryEnabled: boolean;
  completedAt?: string | null;
  memberLimit: number | null;
  availableRepos?: { id: number; name: string; fullName: string; private: boolean }[];
  githubOrgOwner?: boolean;
  githubInvitationBlockedReason?: string | null;
  billing: {
    managerName: string | null;
    canManage: boolean;
    nextAmount: number | null;
    nextBillingAt: string | null;
  };
  ownershipTransfer?: { id: number; fromName: string; toName: string; isRecipient: boolean } | null;
  ownershipClaim?: { eligible: boolean; reason: string } | null;
  completion?: { canUndo: boolean; finalized: boolean; canRestart: boolean } | null;
};
export type Members = {
  items: {
    user: { id: number; login: string | null; name: string; avatarUrl: string | null };
    role: TeamSettings['myRole'];
    /** Short track label next to role (Figma 368:1596 PO/BE/FE); markup field until API lands */
    jobLabel: string | null;
    joinedAt: string;
    inGithubOrg: boolean;
    githubOrgStatus: 'MEMBER' | 'INVITED' | 'NOT_MEMBER';
    githubLogin?: string | null;
  }[];
  count: number;
  limit: number | null;
};
export type ServerMembers = TeamSettingsMembers;
export type InviteLinks = {
  items: { id: number; expiresAt: string; createdBy: string }[];
};

export function settingsOptions(id: string) {
  return queryOptions({
    queryKey: ['team-settings', id],
    queryFn: ({ signal }) => getTeamSettings(Number(id), { signal }),
  });
}
export function membersOptions(id: string) {
  return queryOptions({
    queryKey: ['team-settings', id, 'members'],
    queryFn: async ({ signal }): Promise<Members> => {
      const result = await getTeamMembers(Number(id), { signal });
      return {
        ...result,
        items: result.items.map(
          ({ userId, handle, name, avatarUrl, role, joinedAt, githubOrgStatus, githubLogin }) => ({
            user: { id: userId, login: handle, name, avatarUrl },
            role,
            joinedAt,
            githubOrgStatus,
            ...(githubLogin === undefined ? {} : { githubLogin }),
            inGithubOrg: githubOrgStatus === 'MEMBER',
            jobLabel: null,
          }),
        ),
      };
    },
  });
}
export function invitesOptions(id: string) {
  return queryOptions({
    queryKey: ['team-settings', id, 'invites'],
    queryFn: ({ signal }) => listTeamInviteLinks(Number(id), { signal }),
  });
}

export type CreatedInvite = CreatedTeamInvite;
export function createTeamInvite(teamId: string | number) {
  return createTeamInviteLink(Number(teamId));
}
export function notifyTeamInvite(teamId: number, link: CreatedInvite, handle: string) {
  return sendTeamInvite(teamId, link.id, { handle, code: link.code });
}
export function inviteGithubMember(teamId: number, userId: number) {
  return inviteGithubOrganizationMember(teamId, userId);
}

const pendingInvites = new WeakMap<QueryClient, Map<string, Promise<CreatedInvite>>>();

/** Copy and notification share one code; POST is never an automatically retried query. */
export function getOrCreateTeamInvite(
  client: QueryClient,
  teamId: string | number,
  login: string | null,
) {
  const queryKey = ['team-settings', String(teamId), 'created-invite', login] as const;
  const key = JSON.stringify(queryKey);
  const requests = pendingInvites.get(client) ?? new Map<string, Promise<CreatedInvite>>();
  pendingInvites.set(client, requests);
  const pending = requests.get(key);
  if (pending) return pending;
  const request = (async () => {
    const previous = client.getQueryData<CreatedInvite>(queryKey);
    if (previous && Date.parse(previous.expiresAt) > Date.now()) {
      const active = await listTeamInviteLinks(Number(teamId));
      if (active.items.some((link) => link.id === previous.id)) return previous;
    }
    const created = await createTeamInvite(teamId);
    client.setQueryData(queryKey, created);
    return created;
  })().finally(() => requests.delete(key));
  requests.set(key, request);
  return request;
}
