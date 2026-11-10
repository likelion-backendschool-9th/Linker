import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { TeamSetupFrame } from './_components/team-setup-frame/TeamSetupFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamSetup } from './_components/team-setup/TeamSetup';
import { myTeamsOptions } from '../[id]/_lib/team-queries';

export const metadata = buildMetadata({ title: '팀 생성하기', path: '/teams/new' });

export default async function TeamCreatePage() {
  const client = getQueryClient();
  await client.prefetchQuery(myTeamsOptions());
  return (
    <TeamSetupFrame>
      <HydrationBoundary state={dehydrate(client)}>
        <TeamSetup />
      </HydrationBoundary>
    </TeamSetupFrame>
  );
}
