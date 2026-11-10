import 'server-only';

import { notFound } from 'next/navigation';

import { getQueryClient } from '@/lib/api/query-client';

import { myTeamsOptions, type MyTeam } from './team-queries';

/**
 * The current team for the team pages (11–15), or 404 when the viewer isn't a member.
 * The per-request query client dedupes the call between the layout and the page.
 */
export async function getTeam(teamId: string): Promise<MyTeam> {
  const teams = await getQueryClient().fetchQuery(myTeamsOptions());
  const team = teams.items.find((item) => String(item.id) === teamId);
  if (!team) notFound();
  return team;
}
