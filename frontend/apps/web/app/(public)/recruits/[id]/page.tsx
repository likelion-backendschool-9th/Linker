import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruitDetail } from './_components/recruit-detail/RecruitDetail';
import { recruitDetailOptions } from './_lib/detail-queries';
import { recruitSummary } from './_lib/recruit-summary';

/** Deleted, hidden or a bad id → the shared "unavailable content" page (closed posts stay readable) */
async function loadRecruit(id: string) {
  if (!/^\d+$/.test(id)) notFound();
  const session = await getSession();
  const login = session?.login ?? null;
  try {
    // The request-scoped client dedupes this between generateMetadata and the page
    return { login, recruit: await getQueryClient().fetchQuery(recruitDetailOptions(login, id)) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<'/recruits/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const { recruit } = await loadRecruit(id);
  return buildMetadata({
    title: recruit.title,
    description: recruitSummary(recruit),
    path: `/recruits/${id}`,
    indexable: true,
  });
}

/** 21 Recruit post detail (07 TODO 21, `RecruitmentController`) */
export default async function RecruitDetailPage({ params }: PageProps<'/recruits/[id]'>) {
  const { id } = await params;
  const { recruit } = await loadRecruit(id);

  return (
    <PageFrame title="모집 글" variant="stack" backHref="/recruits">
      {/* Recruit posts are not job postings (blueprint §8-3) */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: recruit.title,
          description: recruitSummary(recruit),
          dateCreated: recruit.createdAt,
          keywords: recruit.techTags.join(', '),
          author: {
            '@type': 'Person',
            name: recruit.author.name,
            url: `/users/${recruit.author.login}`,
          },
        }}
      />
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <RecruitDetail recruitId={id} />
      </HydrationBoundary>
    </PageFrame>
  );
}
