import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { StatsView } from './_components/stats-view';
import { statsSummaryOptions } from './_lib/stats-queries';

export const metadata = buildMetadata({ title: '내 통계', path: '/me/stats' });

export default async function StatsPage() {
  const session = await getSession();
  const client = getQueryClient();
  await client.prefetchQuery(statsSummaryOptions(session?.login ?? null));
  return (
    <PageFrame title="내 통계" variant="stack" backHref="/workspace" bottomTabs>
      <HydrationBoundary state={dehydrate(client)}>
        <StatsView />
      </HydrationBoundary>
    </PageFrame>
  );
}
