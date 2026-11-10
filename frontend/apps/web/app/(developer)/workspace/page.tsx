import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { myTeamsOptions } from '../teams/[id]/_lib/team-queries';
import { WorkspaceView } from './_components/workspace-view/WorkspaceView';
import { prefetchMyIssues } from './_lib/my-issues-queries';

export const metadata = buildMetadata({ title: '워크스페이스', path: '/workspace' });

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string | string[] }>;
}) {
  const client = getQueryClient();
  await client.prefetchQuery(myTeamsOptions());
  await prefetchMyIssues(client, await searchParams);
  return (
    <PageFrame title="워크스페이스" hideTitle>
      <HydrationBoundary state={dehydrate(client)}>
        <WorkspaceView />
      </HydrationBoundary>
    </PageFrame>
  );
}
