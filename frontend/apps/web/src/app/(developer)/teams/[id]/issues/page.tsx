import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { IssueFilterSheet } from '../_components/issue-filter-sheet';
import { TeamFrame } from '../_components/team-frame';
import { loadIssueFilters } from '../_lib/issue-filters';
import { issueListOptions } from '../_lib/issue-queries';
import { IssueList } from './_components/issue-list';
import { parseIssueView } from './_lib/issue-view';

// No team name in the title: team pages are private (frontend AGENTS.md "SEO and privacy")
export const metadata = buildMetadata({ title: '이슈' });

/** 11 Issue list (07 TODO 11, IssueController) */
export default async function IssueListPage({
  params,
  searchParams,
}: PageProps<'/teams/[id]/issues'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const filters = loadIssueFilters(query);
  const view = parseIssueView(query.view);
  await getQueryClient().prefetchInfiniteQuery(issueListOptions(id, view, filters));

  return (
    <TeamFrame teamId={id} title="이슈">
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <IssueList teamId={id} />
        <IssueFilterSheet teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
