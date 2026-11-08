import type { TeamItem } from '@linker/api/openAPIDefinition.schemas';

type TeamChoice = Pick<TeamItem, 'id' | 'status' | 'joinedAt'>;

function byMostRecentlyJoined(a: TeamChoice, b: TeamChoice) {
  return Date.parse(b.joinedAt) - Date.parse(a.joinedAt) || b.id - a.id;
}

/** Most recently joined team; archived teams only when every membership is archived (POL-I-5). */
export function pickDefaultTeam<T extends TeamChoice>(teams: readonly T[]): T | null {
  const candidates = teams.some((team) => team.status !== 'ARCHIVED')
    ? teams.filter((team) => team.status !== 'ARCHIVED')
    : teams;
  return [...candidates].sort(byMostRecentlyJoined)[0] ?? null;
}

/**
 * The team to show for a raw `teamId` from the URL. `isRequestValid` is false when the URL names
 * something that isn't one of my teams, so the screen falls back to the default without a 404.
 */
export function resolveMyIssuesTeam<T extends TeamChoice>(
  teams: readonly T[],
  rawTeamId: string | null | undefined,
): { team: T | null; defaultTeam: T | null; isRequestValid: boolean } {
  const defaultTeam = pickDefaultTeam(teams);
  if (rawTeamId === null || rawTeamId === undefined) {
    return { team: defaultTeam, defaultTeam, isRequestValid: true };
  }
  const requested = teams.find((team) => String(team.id) === rawTeamId);
  return { team: requested ?? defaultTeam, defaultTeam, isRequestValid: requested !== undefined };
}
