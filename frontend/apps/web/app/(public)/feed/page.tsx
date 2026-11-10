import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession, viewerFromSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { FeedList } from './_components/feed-list/FeedList';
import { feedOptions, type FeedTab } from './_lib/feed-queries';

export const metadata: Metadata = buildMetadata({ title: '홈', path: '/feed', indexable: true });

/** 24 Home feed (07 TODO 24, PostController) */
export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  const { role } = viewerFromSession(session);
  const tab: FeedTab = query.tab === 'following' ? 'following' : 'recommended';
  // Same rules as the client: only recruiters have the "제안 받는 개발자만" toggle (추천 only), and
  // guests on "팔로잉" get a login notice, not a request
  const offersOnly = role === 'recruiter' && query.offersOnly === 'true' && tab === 'recommended';
  const client = getQueryClient();
  if (!(tab === 'following' && role === 'guest')) {
    await client.prefetchInfiniteQuery(feedOptions(session?.login ?? null, offersOnly, tab));
  }

  return (
    <PageFrame title="홈" hideTitle>
      <HydrationBoundary state={dehydrate(client)}>
        <FeedList />
      </HydrationBoundary>
    </PageFrame>
  );
}
