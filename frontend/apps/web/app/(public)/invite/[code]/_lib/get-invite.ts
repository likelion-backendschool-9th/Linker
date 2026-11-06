import 'server-only';

import { cache } from 'react';

import { apiFetch } from '@/lib/api/api-fetch';

export type Invite = {
  code: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED';
  team: {
    id: number;
    name: string;
    description: string;
    orgAvatarUrl: string;
    memberCount: number;
  };
  invitedBy: string;
  participation: {
    state:
      | 'ELIGIBLE'
      | 'ALREADY_MEMBER'
      | 'TEAM_MEMBER_LIMIT'
      | 'TEAM_COUNT_LIMIT'
      | 'ACCEPTED'
      | 'READ_ONLY'
      | 'ARCHIVED';
    canManageTeam: boolean;
  };
};

/** One public preview shared by page and metadata; invitation acceptance is not implemented. */
export const getInvite = cache((code: string) =>
  apiFetch<Invite>(`/api/v1/public/invites/${encodeURIComponent(code)}`, { cache: 'no-store' }),
);
