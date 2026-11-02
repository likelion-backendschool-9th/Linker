import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession, viewerFromSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { FeedList } from './_components/feed-list';
import { feedOptions } from './_lib/feed-queries';

export const metadata: Metadata = buildMetadata({ title: '홈', path: '/feed', indexable: true });

/** 24 Home feed (07 TODO 24, `FeedController`) */
export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  const { role } = viewerFromSession(session);
  // Same rule as the client: only recruiters have the "제안 받는 개발자만" toggle
  const offersOnly = role === 'recruiter' && query.offersOnly === 'true';
  const client = getQueryClient();
  await client.prefetchInfiniteQuery(feedOptions(session?.login ?? null, offersOnly));

  return (
    <PageFrame title="홈" hideTitle>
      <HydrationBoundary state={dehydrate(client)}>
        <FeedList />
      </HydrationBoundary>
    </PageFrame>
  );
}
