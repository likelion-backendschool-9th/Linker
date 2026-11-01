import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Route } from 'next';
import { notFound } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame';
import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { RecruitEditor } from '../../_components/recruit-editor/recruit-editor';
import { editFormOptions, editorOptions } from '../../_lib/editor-queries';

export const metadata = buildMetadata({ title: '모집 글 수정' });

/** 20 Edit recruit post (07 TODO 20): author only; someone else's or a deleted post is unavailable */
export default async function RecruitEditPage({ params }: PageProps<'/recruits/[id]/edit'>) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!/^\d+$/.test(id)) notFound();
  const login = session?.login ?? null;
  const client = getQueryClient();

  try {
    await Promise.all([
      client.fetchQuery(editFormOptions(login, id)),
      client.prefetchQuery(editorOptions(login)),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <PageFrame title="모집 글 수정" variant="stack" backHref={`/recruits/${id}` as Route}>
      <HydrationBoundary state={dehydrate(client)}>
        <RecruitEditor mode="edit" recruitId={id} />
      </HydrationBoundary>
    </PageFrame>
  );
}
