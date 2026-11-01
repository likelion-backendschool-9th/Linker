import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { myTeamsOptions } from '../teams/[id]/_lib/team-queries';
import { WorkspaceView } from './_components/workspace-view';

export const metadata = buildMetadata({ title: '워크스페이스', path: '/workspace' });

export default async function WorkspacePage() {
  const client = getQueryClient();
  await client.prefetchQuery(myTeamsOptions());
  return (
    <PageFrame title="워크스페이스">
      <HydrationBoundary state={dehydrate(client)}>
        <WorkspaceView />
      </HydrationBoundary>
    </PageFrame>
  );
}
