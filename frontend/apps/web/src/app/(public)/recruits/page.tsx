import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession, viewerFromSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruitFilterSheet } from './_components/recruit-filter-sheet';
import { RecruitList } from './_components/recruit-list';
import { loadRecruitParams } from './_lib/recruit-filters';
import {
  myApplicationsOptions,
  myRecruitsOptions,
  recruitListOptions,
} from './_lib/recruit-list-queries';

export const metadata = buildMetadata({ title: '팀 찾기', path: '/recruits', indexable: true });

/** 19 Recruit post list (07 TODO 19, `RecruitListController`) */
export default async function RecruitsPage({ searchParams }: PageProps<'/recruits'>) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  const { tab, ...filters } = loadRecruitParams(query);
  const { role } = viewerFromSession(session);
  const login = session?.login ?? null;
  // Same rule as the client: only developers (and operators) open the personal tabs
  const active = role === 'developer' || role === 'operator' ? tab : 'all';
  const client = getQueryClient();
  if (active === 'mine') await client.prefetchInfiniteQuery(myRecruitsOptions(login));
  else if (active === 'applied') await client.prefetchInfiniteQuery(myApplicationsOptions(login));
  else await client.prefetchInfiniteQuery(recruitListOptions(login, filters));

  return (
    <PageFrame title="팀 찾기">
      <HydrationBoundary state={dehydrate(client)}>
        <RecruitList />
        <RecruitFilterSheet />
      </HydrationBoundary>
    </PageFrame>
  );
}
