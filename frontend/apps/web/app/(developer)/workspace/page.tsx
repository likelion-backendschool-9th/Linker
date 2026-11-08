import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { WorkspaceFrame } from './_components/workspace-frame/WorkspaceFrame';
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
    <WorkspaceFrame>
      <HydrationBoundary state={dehydrate(client)}>
        <WorkspaceView />
      </HydrationBoundary>
    </WorkspaceFrame>
  );
}
