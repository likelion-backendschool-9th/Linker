import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame';
import { plansOptions, teamCandidatesOptions } from '@/features/subscription/subscription-api';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { PlanSelector } from './_components/plan-selector';

export const metadata = buildMetadata({ title: '요금제', path: '/subscribe' });

export default async function SubscribePage({ searchParams }: PageProps<'/subscribe'>) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const reason = typeof params.reason === 'string' ? params.reason : '';
  const client = getQueryClient();
  await Promise.all([
    client.prefetchQuery(plansOptions(session?.login ?? null, reason)),
    ...(session?.userType === 'DEVELOPER'
      ? [client.prefetchQuery(teamCandidatesOptions(session.login))]
      : []),
  ]);
  return (
    <PageFrame title="요금제" variant="stack" backHref="/feed">
      <HydrationBoundary state={dehydrate(client)}>
        <PlanSelector key={session?.login ?? 'guest'} reason={reason} />
      </HydrationBoundary>
    </PageFrame>
  );
}
