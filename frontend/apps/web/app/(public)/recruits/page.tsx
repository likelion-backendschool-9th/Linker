import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession, viewerFromSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruitList } from './_components/recruit-list';
import {
  myApplicationsOptions,
  myRecruitsOptions,
  publicRecruitsOptions,
  RECRUIT_LIST_TABS,
  RECRUIT_SORTS,
  type RecruitFormat,
  type RecruitListTab,
  type RecruitRoleKey,
  type RecruitSort,
} from './_lib/list-queries';
import { RECRUIT_FORMATS, RECRUIT_ROLES } from '@/features/recruit/recruit-labels';

export const metadata: Metadata = buildMetadata({
  title: '팀 찾기',
  path: '/recruits',
  indexable: true,
});

function parseTab(value: string | string[] | undefined): RecruitListTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return RECRUIT_LIST_TABS.includes(raw as RecruitListTab) ? (raw as RecruitListTab) : 'all';
}

function parseLiteral<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return allowed.includes(raw as T) ? (raw as T) : null;
}

/** 19 Recruit post list (07 TODO 19, RecruitmentController) */
export default async function RecruitsPage({ searchParams }: PageProps<'/recruits'>) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  const { role } = viewerFromSession(session);
  const login = session?.login ?? null;
  const tab = parseTab(query.tab);
  const filters = {
    role: parseLiteral(query.role, RECRUIT_ROLES) as RecruitRoleKey | null,
    tech: typeof query.tech === 'string' && query.tech ? query.tech : null,
    mode: parseLiteral(query.mode, RECRUIT_FORMATS) as RecruitFormat | null,
    sort: (parseLiteral(query.sort, RECRUIT_SORTS) ?? 'NEWEST') as RecruitSort,
  };
  const client = getQueryClient();
  const loginNeeded = (tab === 'mine' || tab === 'applied') && role === 'guest';

  if (tab === 'all') {
    await client.prefetchInfiniteQuery(publicRecruitsOptions(login, filters));
  } else if (!loginNeeded && tab === 'mine') {
    await client.prefetchInfiniteQuery(myRecruitsOptions(login));
  } else if (!loginNeeded && tab === 'applied') {
    await client.prefetchInfiniteQuery(myApplicationsOptions(login));
  }

  return (
    <PageFrame title="팀 찾기" hideTitle>
      <HydrationBoundary state={dehydrate(client)}>
        <RecruitList />
      </HydrationBoundary>
    </PageFrame>
  );
}
