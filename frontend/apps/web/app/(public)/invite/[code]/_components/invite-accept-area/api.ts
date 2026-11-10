import { acceptTeamInvite } from '@linker/api/team-invitations/p10-invite/p10-invite';
export type { AcceptedTeamInvite as AcceptInviteResult } from '@linker/api/team-invitations/openAPIDefinition.schemas';
export function acceptInvite(code: string) {
  return acceptTeamInvite(encodeURIComponent(code));
}
