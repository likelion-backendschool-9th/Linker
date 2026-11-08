import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { IssueFilterButton } from '../_components/issue-filter-button';
import { IssueFilterSheet } from '../_components/issue-filter-sheet/IssueFilterSheet';
import { TeamFrame } from '../_components/team-frame/TeamFrame';
import { getTeam } from '../_lib/get-team';
import { loadIssueFilters } from '../_lib/issue-filters';
import { issueListOptions } from '../_lib/issue-queries';
import { IssueList } from './_components/issue-list/IssueList';
import { IssueProgress } from './_components/issue-progress';
import { parseIssueSearch, parseIssueView } from './_lib/issue-view';
import styles from './page.module.css';

// No team name in the title: team pages are private (frontend AGENTS.md "SEO and privacy")
export const metadata = buildMetadata({ title: '이슈' });

/** 11 Issue list (07 TODO 11, IssueController), Figma 11 (197:66) */
export default async function IssueListPage({
  params,
  searchParams,
}: PageProps<'/teams/[id]/issues'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const filters = loadIssueFilters(query);
  const view = parseIssueView(query.view);
  const q = parseIssueSearch(query.q);
  const [team] = await Promise.all([
    getTeam(id),
    getQueryClient().prefetchInfiniteQuery(issueListOptions(id, view, filters, q)),
  ]);

  return (
    <TeamFrame teamId={id} title="이슈" actions={<IssueFilterButton appearance="icon" />}>
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <div className={styles.page}>
          <IssueProgress teamId={id} flex={team.plan === 'FLEX'} />
          <IssueList teamId={id} />
        </div>
        <IssueFilterSheet teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
