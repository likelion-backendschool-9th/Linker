'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { collaborationLinks } from '@/lib/navigation/collaboration-links';

import { myTeamsOptions } from './api';

export const FILTERS = ['all', 'ACTIVE', 'COMPLETED', 'READ_ONLY', 'ARCHIVED'] as const;
export const LABELS = {
  all: '전체',
  ACTIVE: '활동 중',
  COMPLETED: '완료',
  READ_ONLY: '읽기 전용',
  ARCHIVED: '보관됨',
} as const;

export function useWorkspaceView() {
  const [teamId] = useQueryState('teamId');
  const myIssuesHref = teamId
    ? (`/workspace/issues?teamId=${encodeURIComponent(teamId)}` as Route)
    : collaborationLinks.myIssues;
  return { myIssuesHref };
}

export function useWorkspaceTeams() {
  const teams = useQuery(myTeamsOptions());
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringLiteral(FILTERS).withDefault('all'),
  );

  const activeCount = teams.data?.teamCount ?? 0;
  const teamLimit = teams.data?.teamLimit ?? 0;
  const atLimit = teams.data ? activeCount >= teamLimit : false;
  const items =
    teams.data?.items.filter((team) => filter === 'all' || team.status === filter) ?? [];

  return {
    teams,
    filter,
    setFilter,
    activeCount,
    teamLimit,
    atLimit,
    items,
  };
}
