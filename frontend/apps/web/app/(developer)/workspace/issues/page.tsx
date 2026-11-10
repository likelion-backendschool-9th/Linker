import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Route } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { myTeamsOptions } from '../../teams/[id]/_lib/team-queries';
import { MyIssuesSection } from '../_components/my-issues-section';
import { prefetchMyIssues } from '../_lib/my-issues-queries';

const WORKSPACE_HOME = '/workspace' as Route;

export const metadata = buildMetadata({ title: '내 이슈' });

/** 07 "내 이슈" full list: every open issue assigned to me in the selected team (POL-I-5). */
export default async function MyIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string | string[] }>;
}) {
  const client = getQueryClient();
  await client.prefetchQuery(myTeamsOptions());
  await prefetchMyIssues(client, await searchParams);
  return (
    <PageFrame title="내 이슈" variant="stack" backHref={WORKSPACE_HOME}>
      <HydrationBoundary state={dehydrate(client)}>
        <MyIssuesSection />
      </HydrationBoundary>
    </PageFrame>
  );
}
