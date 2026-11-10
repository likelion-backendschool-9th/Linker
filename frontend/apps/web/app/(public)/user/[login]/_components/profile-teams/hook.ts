'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchProfileTeams } from './api';

export function useProfileTeams(login: string) {
  return useQuery({
    queryKey: ['profile-teams', login],
    queryFn: () => fetchProfileTeams(login),
  });
}
