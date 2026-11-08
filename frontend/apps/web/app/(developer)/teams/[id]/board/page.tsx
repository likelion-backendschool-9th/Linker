import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { IssueFilterButton } from '../_components/issue-filter-button';
import { IssueFilterSheet } from '../_components/issue-filter-sheet/IssueFilterSheet';
import { TeamFrame } from '../_components/team-frame/TeamFrame';
import { loadIssueFilters } from '../_lib/issue-filters';
import { BoardView } from './_components/board-view';
import { boardOptions } from './_lib/board-queries';

// No team name in the title: team pages are private (frontend AGENTS.md "SEO and privacy")
export const metadata = buildMetadata({ title: '상태 보드' });

/** 14 Status board (07 TODO 14, `IssueController`), Figma 14 (200:1028) */
export default async function BoardPage({ params, searchParams }: PageProps<'/teams/[id]/board'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const client = getQueryClient();
  await client.prefetchQuery(boardOptions(id, loadIssueFilters(query)));

  return (
    <TeamFrame teamId={id} title="상태 보드" actions={<IssueFilterButton appearance="icon" />}>
      <HydrationBoundary state={dehydrate(client)}>
        <BoardView teamId={id} />
        {/* Repo, assignee, label, open only: the "필터" menu on the board picks the status column */}
        <IssueFilterSheet teamId={id} showStatus={false} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
