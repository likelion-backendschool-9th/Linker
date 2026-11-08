import { pickDefaultTeam, resolveMyIssuesTeam } from './my-issues-team';

const team = (id: number, status: 'ACTIVE' | 'COMPLETED' | 'READ_ONLY' | 'ARCHIVED', joinedAt: string) => ({
  id,
  status,
  joinedAt,
});

describe('pickDefaultTeam', () => {
  it('picks the most recently joined team', () => {
    const teams = [
      team(1, 'ACTIVE', '2026-01-01T00:00:00Z'),
      team(2, 'COMPLETED', '2026-03-01T00:00:00Z'),
      team(3, 'READ_ONLY', '2026-02-01T00:00:00Z'),
    ];
    expect(pickDefaultTeam(teams)?.id).toBe(2);
  });

  it('puts archived teams last even when they were joined most recently', () => {
    const teams = [
      team(1, 'ARCHIVED', '2026-09-01T00:00:00Z'),
      team(2, 'ACTIVE', '2026-01-01T00:00:00Z'),
    ];
    expect(pickDefaultTeam(teams)?.id).toBe(2);
  });

  it('falls back to the newest archived team when every team is archived', () => {
    const teams = [
      team(1, 'ARCHIVED', '2026-01-01T00:00:00Z'),
      team(2, 'ARCHIVED', '2026-05-01T00:00:00Z'),
    ];
    expect(pickDefaultTeam(teams)?.id).toBe(2);
  });

  it('breaks a joinedAt tie by the larger team id, like the team list API', () => {
    const teams = [team(4, 'ACTIVE', '2026-01-01T00:00:00Z'), team(9, 'ACTIVE', '2026-01-01T00:00:00Z')];
    expect(pickDefaultTeam(teams)?.id).toBe(9);
  });

  it('returns null without teams', () => {
    expect(pickDefaultTeam([])).toBeNull();
  });
});

describe('resolveMyIssuesTeam', () => {
  const teams = [team(1, 'ACTIVE', '2026-01-01T00:00:00Z'), team(2, 'ACTIVE', '2026-02-01T00:00:00Z')];

  it('uses the requested team when it is mine, archived included', () => {
    const archived = [...teams, team(3, 'ARCHIVED', '2025-01-01T00:00:00Z')];
    expect(resolveMyIssuesTeam(archived, '3')).toMatchObject({
      team: { id: 3 },
      isRequestValid: true,
    });
  });

  it('uses the default team when the URL has no teamId', () => {
    expect(resolveMyIssuesTeam(teams, null)).toMatchObject({ team: { id: 2 }, isRequestValid: true });
  });

  it.each(['99', 'abc', '1.5', '', '-1'])('falls back to the default for %j', (raw) => {
    expect(resolveMyIssuesTeam(teams, raw)).toMatchObject({
      team: { id: 2 },
      isRequestValid: false,
    });
  });
});
