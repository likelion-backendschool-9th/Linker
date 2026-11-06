import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

import { PostCreate } from '../_components/post-editor/post-create/PostCreate';
import { editorReposOptions, repoSummaryOptions } from '../_lib/editor-queries';

export const metadata = buildMetadata({ title: '게시물 쓰기' });

const loadNav = createLoader({ step: parseAsInteger, repo: parseAsInteger, teamId: parseAsString });

/** 22 Write project post (07 TODO 22, `PostController`): step 1 repo → step 2 content */
export default async function PostNewPage({ searchParams }: PageProps<'/posts/new'>) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  const login = session?.login ?? null;
  const { step, repo, teamId } = loadNav(query);
  const client = getQueryClient();
  if (step === 2 && repo !== null) await client.prefetchQuery(repoSummaryOptions(login, repo));
  else await client.prefetchQuery(editorReposOptions(login, '', teamId));

  return (
    <PageFrame title="게시물 쓰기" variant="stack" backHref="/feed">
      <HydrationBoundary state={dehydrate(client)}>
        <PostCreate />
      </HydrationBoundary>
    </PageFrame>
  );
}
