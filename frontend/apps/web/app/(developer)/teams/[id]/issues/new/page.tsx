import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Route } from 'next';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { IssueCreate } from './_components/issue-create/IssueCreate';
import { createReposOptions } from './_lib/create-queries';

export const metadata = buildMetadata({ title: '이슈 작성' });

/** 13 Create issue (07 TODO 13). Header matches Figma 13: back + "이슈 작성". */
export default async function IssueCreatePage({ params }: PageProps<'/teams/[id]/issues/new'>) {
  const { id } = await params;
  const client = getQueryClient();
  await client.prefetchQuery(createReposOptions(id));
  return (
    <PageFrame
      title="이슈 작성"
      variant="stack"
      backHref={`/teams/${id}/issues` as Route}
      bottomTabs={false}
    >
      <HydrationBoundary state={dehydrate(client)}>
        <IssueCreate teamId={id} />
      </HydrationBoundary>
    </PageFrame>
  );
}
