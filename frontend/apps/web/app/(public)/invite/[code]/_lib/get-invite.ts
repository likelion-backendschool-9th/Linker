import 'server-only';

import { cache } from 'react';

import { apiFetch } from '@/lib/api/api-fetch';

export type Invite = {
  code: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED';
  /** Accept redirect / already-member routing only — not rendered on the slim landing (POL-T-2) */
  team: {
    id: number;
  };
  participation: {
    state:
      | 'ELIGIBLE'
      | 'ALREADY_MEMBER'
      | 'TEAM_MEMBER_LIMIT'
      | 'TEAM_COUNT_LIMIT'
      | 'ACCEPTED'
      | 'READ_ONLY'
      | 'ARCHIVED';
  };
};

/** Public invite status for page 10; UI never renders team detail from this payload. */
export const getInvite = cache((code: string) =>
  apiFetch<Invite>(`/api/v1/public/invites/${encodeURIComponent(code)}`, { cache: 'no-store' }),
);
