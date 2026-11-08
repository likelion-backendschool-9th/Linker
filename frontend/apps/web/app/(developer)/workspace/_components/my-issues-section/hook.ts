'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';
import { useEffect } from 'react';

import { ApiError } from '@/lib/api/api-error';

import { resolveMyIssuesTeam } from '../../_lib/my-issues-team';
import { myIssuesOptions, myTeamsOptions } from './api';

const teamIdParser = parseAsString.withOptions({ history: 'replace', shallow: true });

/** Selected team in the URL (POL-I-5). The default team is implied, so its `teamId` stays out. */
export function useMyIssuesSection() {
  const teams = useQuery(myTeamsOptions());
  const [rawTeamId, setTeamId] = useQueryState('teamId', teamIdParser);
  const { team, defaultTeam, isRequestValid } = resolveMyIssuesTeam(
    teams.data?.items ?? [],
    rawTeamId,
  );
  const issues = useQuery({ ...myIssuesOptions(team?.id ?? 0), enabled: team !== null });

  const hasTeams = teams.data !== undefined;
  useEffect(() => {
    if (hasTeams && !isRequestValid) void setTeamId(null);
  }, [hasTeams, isRequestValid, setTeamId]);

  // Membership changed since the team list loaded: the server rejects the team with 400
  const issuesError: unknown = issues.error;
  const isStaleTeam = issuesError instanceof ApiError && issuesError.status === 400;
  const { refetch: refetchTeams } = teams;
  useEffect(() => {
    if (!isStaleTeam) return;
    void setTeamId(null);
    void refetchTeams();
  }, [isStaleTeam, setTeamId, refetchTeams]);

  function selectTeam(id: number) {
    return setTeamId(id === defaultTeam?.id ? null : String(id));
  }

  return { teams, team, issues, selectTeam };
}
