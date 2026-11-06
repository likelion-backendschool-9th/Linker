import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamSetup } from './_components/team-setup/TeamSetup';
import { myTeamsOptions } from '../[id]/_lib/team-queries';

export const metadata = buildMetadata({ title: '팀 만들기', path: '/teams/new' });

export default async function TeamCreatePage() {
  const client = getQueryClient();
  await client.prefetchQuery(myTeamsOptions());
  return (
    <PageFrame title="팀 만들기" variant="stack" backHref="/workspace">
      <HydrationBoundary state={dehydrate(client)}>
        <TeamSetup />
      </HydrationBoundary>
    </PageFrame>
  );
}
