'use client';

import type { Route } from 'next';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useOverlay } from '@/lib/navigation/use-overlay';
import { useMyIssuesSection } from '../my-issues-section/hook';

export const FILTERS = ['ACTIVE', 'COMPLETED', 'READ_ONLY', 'ARCHIVED'] as const;
export const LABELS = {
  ACTIVE: '활성',
  COMPLETED: '완료',
  READ_ONLY: '읽기 전용',
  ARCHIVED: '보관',
} as const;

export function useWorkspaceView() {
  const selection = useMyIssuesSection();
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringLiteral(FILTERS).withDefault('ACTIVE'),
  );
  const overlay = useOverlay('my-issues-team');
  const [rawTeamId] = useQueryState('teamId');
  const { teams, team } = selection;
  const items = teams.data?.items.filter((item) => item.status === filter) ?? [];
  const atLimit = teams.data ? teams.data.teamCount >= teams.data.teamLimit : false;
  const myIssuesHref = (
    team && rawTeamId === String(team.id)
      ? `/workspace/issues?teamId=${team.id}`
      : '/workspace/issues'
  ) as Route;
  return { ...selection, overlay, filter, setFilter, items, atLimit, myIssuesHref };
}
