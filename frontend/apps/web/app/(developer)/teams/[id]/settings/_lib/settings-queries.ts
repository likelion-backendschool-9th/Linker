import { queryOptions } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/api-fetch';

/** Read-only provisional WBS 09 contracts; no mutation endpoints in the UI phase. */
export type TeamSettings = {
  id: number;
  name: string;
  description: string;
  orgLogin: string;
  orgAvatarUrl: string;
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
  repos: { id: number; name: string; fullName: string; private: boolean }[];
  board: { id: string; name: string; url: string };
  aiSummaryEnabled: boolean;
  completedAt: string | null;
  memberLimit: number | null;
  availableRepos: { id: number; name: string; fullName: string; private: boolean }[];
  githubOrgOwner: boolean;
  githubInvitationBlockedReason: string | null;
  billing: {
    managerName: string;
    canManage: boolean;
    nextAmount: number | null;
    nextBillingAt: string | null;
  };
  ownershipTransfer: { id: number; fromName: string; toName: string; isRecipient: boolean } | null;
  ownershipClaim: { eligible: boolean; reason: string } | null;
  completion: { canUndo: boolean; finalized: boolean; canRestart: boolean };
};
export type Members = {
  items: {
    user: { id: number; login: string; name: string; avatarUrl: string };
    role: TeamSettings['myRole'];
    /** Short track label next to role (Figma 368:1596 PO/BE/FE); markup field until API lands */
    jobLabel: string | null;
    joinedAt: string;
    inGithubOrg: boolean;
    githubOrgStatus: 'MEMBER' | 'INVITED' | 'NOT_MEMBER';
  }[];
  count: number;
  limit: number | null;
};
export type InviteLinks = {
  items: { id: number; code: string; expiresAt: string; createdBy: string }[];
};

export function settingsOptions(id: string) {
  return queryOptions({
    queryKey: ['team-settings', id],
    queryFn: ({ signal }) =>
      apiFetch<TeamSettings>(`/api/v1/user/teams/${id}/settings`, { signal }),
  });
}
export function membersOptions(id: string) {
  return queryOptions({
    queryKey: ['team-settings', id, 'members'],
    queryFn: ({ signal }) => apiFetch<Members>(`/api/v1/user/teams/${id}/members`, { signal }),
  });
}
export function invitesOptions(id: string) {
  return queryOptions({
    queryKey: ['team-settings', id, 'invites'],
    queryFn: ({ signal }) =>
      apiFetch<InviteLinks>(`/api/v1/user/teams/${id}/invite-links`, { signal }),
  });
}
