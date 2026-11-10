import 'server-only';
import { cache } from 'react';
import { getTeamInvite } from '@linker/api/team-invitations/p10-invite/p10-invite';
import type { TeamInviteLanding } from '@linker/api/team-invitations/openAPIDefinition.schemas';
export type Invite = TeamInviteLanding;
/** Public invite status; the slim landing never renders team details. */
export const getInvite = cache((code: string) =>
  getTeamInvite(encodeURIComponent(code), { cache: 'no-store' }),
);
