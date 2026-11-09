/** Query helpers for TeamSetup — thin re-exports from shared `_lib`. */
export { myTeamsOptions } from '../../../[id]/_lib/team-queries';
export { setupPermissionOptions } from '../../../_lib/setup-queries';
export { settingsOptions } from '../../../[id]/settings/_lib/settings-queries';
export { createTeam } from '@linker/api/p08-team-create/p08-team-create';

import { apiFetch } from '@/lib/api/api-fetch';

/** Existing S07 PATCH contract; p09 is not yet included in the generated client. */
export function updateSetupTeamInfo(teamId: number, info: { name: string; description: string }) {
  return apiFetch<void>(`/api/v1/user/teams/${teamId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(info),
  });
}
