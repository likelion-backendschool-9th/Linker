import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/page-frame';
import { paymentsOptions, subscriptionsOptions } from '@/features/subscription/management-api';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { SubscriptionManager } from './_components/subscription-manager';
export const metadata = buildMetadata({ title: '구독 관리', path: '/settings/subscription' });
export default async function SubscriptionPage() {
  const session = await getSession();
  const client = getQueryClient();
  await Promise.all([
    client.prefetchQuery(subscriptionsOptions(session?.login ?? null)),
    client.prefetchQuery(paymentsOptions(session?.login ?? null)),
  ]);
  return (
    <PageFrame title="구독 관리" variant="stack" backHref="/feed">
      <HydrationBoundary state={dehydrate(client)}>
        <SubscriptionManager key={session?.login ?? 'guest'} />
      </HydrationBoundary>
    </PageFrame>
  );
}
