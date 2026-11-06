import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruitEditor } from '../_components/recruit-editor';
import { editorOptions } from '../_lib/editor-queries';

export const metadata = buildMetadata({ title: '모집 글 쓰기' });

/** 20 Write recruit post (07 TODO 20, `RecruitmentController`) */
export default async function RecruitNewPage() {
  const session = await getSession();
  const client = getQueryClient();
  await client.prefetchQuery(editorOptions(session?.login ?? null));

  return (
    <PageFrame title="모집 글 쓰기" variant="stack" backHref="/recruits">
      <HydrationBoundary state={dehydrate(client)}>
        <RecruitEditor mode="create" />
      </HydrationBoundary>
    </PageFrame>
  );
}
