'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import { issueCountOptions, issueProgressOptions } from './api';

/** The four statuses of the cards, in Figma order (완료, 진행 / 정지, 작업 전) */
export const PROGRESS_STATUSES = ['DONE', 'IN_PROGRESS', 'BLOCKED', 'TODO'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

/**
 * Team-wide counts for the cards (every team: list totals per status, no filters) and the Flex-only
 * 14-day trend. A Free team never calls the progress API, so no plan-limit sheet pops up.
 */
export function useIssueProgress(teamId: string, flex: boolean) {
  const counts = useQueries({
    queries: [
      issueCountOptions(teamId, {}),
      ...PROGRESS_STATUSES.map((status) => issueCountOptions(teamId, { status })),
    ],
  });
  const progress = useQuery({ ...issueProgressOptions(teamId), enabled: flex });

  const [total, ...byStatus] = counts.map((query) => query.data);
  const ready = total !== undefined && byStatus.every((value) => value !== undefined);
  const failed = counts.some((query) => query.isError);

  return {
    total: total ?? 0,
    counts: Object.fromEntries(
      PROGRESS_STATUSES.map((status, index) => [status, byStatus[index] ?? 0]),
    ) as Record<ProgressStatus, number>,
    ready,
    failed,
    retry: () => counts.forEach((query) => void query.refetch()),
    progress,
  };
}
