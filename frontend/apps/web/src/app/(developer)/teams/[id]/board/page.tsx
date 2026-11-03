import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { IssueFilterSheet } from '../_components/issue-filter-sheet';
import { TeamFrame } from '../_components/team-frame';
import { loadIssueFilters } from '../_lib/issue-filters';
import { BoardView } from './_components/board-view';
import { boardOptions } from './_lib/board-queries';

export const metadata = buildMetadata({ title: '상태 보드' });

/** 14 Status board (07 TODO 14, `IssueController`) */
export default async function BoardPage({ params, searchParams }: PageProps<'/teams/[id]/board'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const client = getQueryClient();
  await client.prefetchQuery(boardOptions(id, loadIssueFilters(query)));

  return (
    <TeamFrame teamId={id} title="상태 보드">
      <HydrationBoundary state={dehydrate(client)}>
        <BoardView teamId={id} />
        {/* The columns are the statuses, so the status filter is off here */}
        <IssueFilterSheet teamId={id} showStatus={false} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
