import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageFrame } from '@/components/layout/page-frame/PageFrame';
import { ApiError } from '@/lib/api/api-error';
import { getQueryClient } from '@/lib/api/query-client';
import { getSession } from '@/lib/auth/session';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

import { PostDetail } from './_components/post-detail/PostDetail';
import { postDetailOptions } from './_lib/post-detail-queries';

const DESCRIPTION_LENGTH = 120;

/** Deleted, hidden (for others) or a bad id → the shared "unavailable content" page */
async function loadPost(id: string, from: string | null) {
  if (!/^\d+$/.test(id)) notFound();
  const session = await getSession();
  try {
    // The request-scoped client dedupes this between generateMetadata and the page
    return await getQueryClient().fetchQuery(postDetailOptions(session?.login ?? null, id, from));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

const fromParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : null;

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/posts/[id]'>): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const post = await loadPost(id, fromParam(query.from));
  // Hidden posts (only their author gets here) keep the defaults (blueprint §8-3)
  if (post.visibility !== 'VISIBLE') return buildMetadata({ title: '게시물' });
  return buildMetadata({
    title: post.intro,
    description: post.body.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_LENGTH) || undefined,
    // Cover photo; the repo-card `opengraph-image.tsx` for posts without photos is still to come
    image: post.photos[0],
    // `?from=share` and other params never reach canonical / og:url
    path: `/posts/${id}`,
    indexable: true,
  });
}

/** 23 Project post detail (07 TODO 23, PostController) */
export default async function PostDetailPage({ params, searchParams }: PageProps<'/posts/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const post = await loadPost(id, fromParam(query.from));

  return (
    <PageFrame title="게시물" variant="stack" backHref="/feed">
      {post.visibility === 'VISIBLE' && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: post.intro,
            datePublished: post.createdAt,
            image: post.photos[0],
            codeRepository: `https://github.com/${post.repo.fullName}`,
            author: {
              '@type': 'Person',
              name: post.author.name,
              url: `/users/${post.author.login}`,
            },
          }}
        />
      )}
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <PostDetail postId={id} />
      </HydrationBoundary>
    </PageFrame>
  );
}
