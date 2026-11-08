import type { MyTeamsResponse } from '@linker/api/openAPIDefinition.schemas';
import { getGetMyIssuesQueryOptions } from '@linker/api/p07-workspace/p07-workspace';
import type { QueryClient } from '@tanstack/react-query';

import { teamKeys } from '../../teams/[id]/_lib/team-queries';
import { resolveMyIssuesTeam } from './my-issues-team';

/** Under ['issues', teamId], the prefix pages 11–15 invalidate, so their changes refresh this list. */
export function myIssuesKey(teamId: number) {
  return ['issues', String(teamId), 'mine'] as const;
}

export function myIssuesOptions(teamId: number) {
  return getGetMyIssuesQueryOptions(
    { teamId },
    { query: { queryKey: myIssuesKey(teamId) }, request: { cache: 'no-store' } },
  );
}

/** Server side of the selected team's issues. Call after my teams are prefetched into `client`. */
export async function prefetchMyIssues(
  client: QueryClient,
  searchParams: { teamId?: string | string[] },
) {
  const teams = client.getQueryData<MyTeamsResponse>(teamKeys.mine);
  if (!teams) return;
  const raw = Array.isArray(searchParams.teamId) ? searchParams.teamId[0] : searchParams.teamId;
  const { team } = resolveMyIssuesTeam(teams.items, raw);
  if (team) await client.prefetchQuery(myIssuesOptions(team.id));
}
