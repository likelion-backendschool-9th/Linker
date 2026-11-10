'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useViewer } from '@/lib/auth/viewer-context';
import { teamKeys } from '../../../[id]/_lib/team-queries';
import { getListSetupRepositoriesQueryOptions, saveSetupRepositories } from './api';

export function useTeamSetupRepositories(
  teamId: number | null,
  selected: number[],
  onNext: () => void,
) {
  const [search, setSearch] = useState('');
  const client = useQueryClient();
  const viewer = useViewer();
  const repos = useQuery(
    getListSetupRepositoriesQueryOptions(teamId ?? 0, {
      query: { queryKey: ['team-setup', viewer.login, teamId, 'repos'], enabled: teamId !== null },
      request: { cache: 'no-store' },
    }),
  );
  const available = repos.data?.items ?? [];
  const allowed = new Set(available.map((repo) => repo.id));
  const validSelected = [...new Set(selected)].filter((id) => allowed.has(id));
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = available.filter((repo) =>
    `${repo.name} ${repo.fullName}`.toLocaleLowerCase().includes(keyword),
  );
  const save = useMutation({
    mutationFn: () => {
      if (!teamId || !validSelected.length || !repos.isSuccess)
        throw new Error('저장소를 다시 선택해 주세요');
      return saveSetupRepositories(teamId, { repoIds: validSelected });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: teamKeys.mine });
      onNext();
    },
  });
  return { search, setSearch, repos, filtered, validSelected, save };
}
