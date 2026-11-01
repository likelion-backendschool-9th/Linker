import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Route } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { MyIssueList } from './_components/my-issue-list';
import { myIssuesOptions } from './_lib/my-issues-queries';

// 07 workspace home (B); typed once that route exists
const WORKSPACE_HOME = '/workspace' as Route;

export const metadata = buildMetadata({ title: '내 이슈' });

/**
 * 07's "내 이슈" (07 TODO 07, I-5) as its own page, linked from the workspace home: issues assigned to
 * me across all teams by due date. Team decision 2026-11-01, so 07 doesn't have to exist first.
 */
export default async function MyIssuesPage() {
  const client = getQueryClient();
  await client.prefetchQuery(myIssuesOptions());
  return (
    <PageFrame title="내 이슈" variant="stack" backHref={WORKSPACE_HOME}>
      <HydrationBoundary state={dehydrate(client)}>
        <MyIssueList />
      </HydrationBoundary>
    </PageFrame>
  );
}
