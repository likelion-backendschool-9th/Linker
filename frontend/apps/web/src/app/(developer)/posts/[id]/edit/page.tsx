import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Route } from 'next';
import { notFound } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame';
import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { PostEdit } from '../../_components/post-editor/post-edit';
import { postEditFormOptions } from '../../_lib/editor-queries';

export const metadata = buildMetadata({ title: '게시물 수정' });

/** 22 Edit project post (07 TODO 22): author only; someone else's or a deleted post is unavailable */
export default async function PostEditPage({ params }: PageProps<'/posts/[id]/edit'>) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!/^\d+$/.test(id)) notFound();
  const client = getQueryClient();
  try {
    await client.fetchQuery(postEditFormOptions(session?.login ?? null, id));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    // 23 post detail (E, D8); typed once that route exists
    <PageFrame title="게시물 수정" variant="stack" backHref={`/posts/${id}` as Route}>
      <HydrationBoundary state={dehydrate(client)}>
        <PostEdit postId={id} />
      </HydrationBoundary>
    </PageFrame>
  );
}
