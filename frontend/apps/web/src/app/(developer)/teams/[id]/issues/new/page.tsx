import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/api/query-client';
import { buildMetadata } from '@/lib/seo/metadata';

import { TeamFrame } from '../../_components/team-frame';
import { IssueCreate } from './_components/issue-create';
import { createReposOptions } from './_lib/create-queries';

export const metadata = buildMetadata({ title: '이슈 작성' });

/** 13 Create issue (07 TODO 13, `IssueCreateController`): step 1 repo + template → step 2 content */
export default async function IssueCreatePage({ params }: PageProps<'/teams/[id]/issues/new'>) {
  const { id } = await params;
  const client = getQueryClient();
  await client.prefetchQuery(createReposOptions(id));
  return (
    <TeamFrame teamId={id} title="이슈 작성">
      <HydrationBoundary state={dehydrate(client)}>
        <IssueCreate teamId={id} />
      </HydrationBoundary>
    </TeamFrame>
  );
}
