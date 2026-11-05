import { getGetMyTeamsQueryOptions } from '@linker/api/p07-workspace/p07-workspace';
import type { TeamItem } from '@linker/api/openAPIDefinition.schemas';

export type MyTeam = TeamItem;
export type { MyTeamsResponse } from '@linker/api/openAPIDefinition.schemas';

export const teamKeys = {
  mine: ['teams', 'mine'] as const,
};

/** My teams. The team pages (11–15) read the current team's name and chat room from here. */
export function myTeamsOptions() {
  return getGetMyTeamsQueryOptions({
    query: { queryKey: teamKeys.mine, refetchOnMount: 'always' },
    request: { cache: 'no-store' },
  });
}
